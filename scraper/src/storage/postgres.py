import logging
import uuid

import psycopg
from psycopg.rows import dict_row

from src.config import DATABASE_URL
from src.utils.urls import normalize_url

logger = logging.getLogger(__name__)

# Serializes cluster rebuilds if two ingestion runs ever overlap.
CLUSTER_REBUILD_LOCK = "news_pulse_cluster_rebuild"


class PostgresStorage:
    """
    Usage:
        with PostgresStorage() as storage:
            ...

    Reads run in autocommit mode. Every write happens inside an explicit
    `with conn.transaction()` block: it commits when the block finishes and
    rolls back if anything inside raises.
    """

    def __init__(self, database_url=DATABASE_URL):
        if not database_url:
            raise RuntimeError("DATABASE_URL is not set")
        self._database_url = database_url
        self.conn = None

    def __enter__(self):
        self.conn = psycopg.connect(self._database_url, row_factory=dict_row, autocommit=True)
        # publishedAt is `timestamp without time zone` holding UTC. Pinning the
        # session to UTC means timezone-aware values are stored without shifting.
        self.conn.execute("SET TIME ZONE 'UTC'")
        return self

    def __exit__(self, exc_type, exc, tb):
        if self.conn is not None:
            self.conn.close()
            self.conn = None
        return False

    def get_existing_urls(self):
        """
        Normalized URLs of every stored article. Older rows were stored before
        URL normalization (e.g. BBC links with tracking parameters), so stored
        URLs are normalized too before comparing.
        """
        with self.conn.cursor() as cur:
            cur.execute('SELECT url FROM "Article"')
            return {normalize_url(row["url"]) or row["url"] for row in cur}

    def insert_articles(self, articles):
        """
        Inserts all articles in one statement and one transaction. ON CONFLICT
        keeps the database's UNIQUE(url) constraint as the final guard against
        duplicates. Returns the number of rows actually inserted.
        """
        if not articles:
            return 0

        columns = {
            "id": [str(uuid.uuid4()) for _ in articles],
            "source": [a["source"] for a in articles],
            "headline": [a["headline"] for a in articles],
            "summary": [a.get("summary") or None for a in articles],
            "body": [a.get("body") or None for a in articles],
            "url": [a["url"] for a in articles],
            "publishedAt": [a["publishedAt"] for a in articles],
        }
        with self.conn.transaction(), self.conn.cursor() as cur:
            cur.execute(
                '''
                INSERT INTO "Article" (id, source, headline, summary, body, url, "publishedAt")
                SELECT * FROM unnest(
                    %s::text[], %s::text[], %s::text[], %s::text[], %s::text[], %s::text[], %s::timestamptz[]
                )
                ON CONFLICT (url) DO NOTHING
                RETURNING url
                ''',
                list(columns.values()),
            )
            inserted = len(cur.fetchall())

        logger.info(f"[DB] Inserted {inserted} new articles.")
        if inserted < len(articles):
            logger.info(f"[DB] {len(articles) - inserted} skipped by ON CONFLICT (url already stored)")
        return inserted

    def get_articles_for_clustering(self, max_body_chars):
        """
        Every stored article, in a fixed order so clustering is reproducible.
        Only the first max_body_chars of each body is transferred.
        """
        with self.conn.cursor() as cur:
            cur.execute(
                '''
                SELECT id, source, headline, summary, LEFT(body, %s) AS body, url, "publishedAt"
                FROM "Article"
                ORDER BY "publishedAt", id
                ''',
                (max_body_chars,),
            )
            return cur.fetchall()

    def needs_recluster(self):
        """True when some article has no cluster, or no clusters exist yet."""
        with self.conn.cursor() as cur:
            cur.execute(
                '''
                SELECT EXISTS (SELECT 1 FROM "Article" WHERE "clusterId" IS NULL)
                    OR NOT EXISTS (SELECT 1 FROM "Cluster") AS needed
                '''
            )
            return cur.fetchone()["needed"]

    def replace_clusters(self, clusters, articles):
        """
        Rebuilds all clusters atomically:
            BEGIN -> unlink articles -> delete clusters -> insert clusters
                  -> link articles -> verify -> COMMIT
        Any error rolls everything back, leaving the previous clusters intact.
        Article rows are never deleted.
        """
        cluster_ids, labels, article_ids, assigned_cluster_ids = [], [], [], []
        for cluster in clusters:
            cluster_id = str(uuid.uuid4())
            cluster_ids.append(cluster_id)
            labels.append(cluster["label"])
            for index in cluster["article_indices"]:
                article_ids.append(articles[index]["id"])
                assigned_cluster_ids.append(cluster_id)

        if len(set(article_ids)) != len(article_ids):
            raise ValueError("an article was assigned to more than one cluster")

        with self.conn.transaction(), self.conn.cursor() as cur:
            cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (CLUSTER_REBUILD_LOCK,))
            cur.execute('UPDATE "Article" SET "clusterId" = NULL WHERE "clusterId" IS NOT NULL')
            cur.execute('DELETE FROM "Cluster"')
            cur.execute(
                'INSERT INTO "Cluster" (id, label) SELECT * FROM unnest(%s::text[], %s::text[])',
                (cluster_ids, labels),
            )
            cur.execute(
                '''
                UPDATE "Article" AS a
                SET "clusterId" = v.cluster_id
                FROM unnest(%s::text[], %s::text[]) AS v(article_id, cluster_id)
                WHERE a.id = v.article_id
                ''',
                (article_ids, assigned_cluster_ids),
            )
            if cur.rowcount != len(article_ids):
                raise RuntimeError(
                    f"expected to assign {len(article_ids)} articles but updated {cur.rowcount}; rolling back"
                )

        logger.info(f"[DB] Replaced clusters in one transaction: {len(cluster_ids)} clusters, {len(article_ids)} articles linked")
