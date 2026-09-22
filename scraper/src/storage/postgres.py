import logging
import psycopg2
from psycopg2.extras import DictCursor
import uuid
from datetime import datetime, timezone
from src.config import DATABASE_URL

logger = logging.getLogger(__name__)

class PostgresStorage:
    def __init__(self):
        self.conn = psycopg2.connect(DATABASE_URL)
        self.conn.autocommit = False

    def __del__(self):
        if hasattr(self, 'conn') and self.conn:
            self.conn.close()

    def get_existing_urls(self):
        with self.conn.cursor() as cur:
            cur.execute('SELECT url FROM "Article"')
            return {row[0] for row in cur.fetchall()}

    def get_all_articles(self):
        with self.conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute('SELECT id, source, headline, summary, body, url, "publishedAt" FROM "Article"')
            return [dict(row) for row in cur.fetchall()]

    def insert_articles(self, articles_list):
        if not articles_list:
            return
            
        inserted_count = 0
        with self.conn.cursor() as cur:
            for article in articles_list:
                article_id = str(uuid.uuid4())
                try:
                    cur.execute('''
                        INSERT INTO "Article"
                        (id, source, headline, summary, body, url, "publishedAt")
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (url) DO NOTHING
                    ''', (
                        article_id,
                        article.get('source', 'Unknown'),
                        article.get('headline', ''),
                        article.get('summary', ''),
                        article.get('body', ''),
                        article.get('url', ''),
                        article.get('publishedAt', datetime.now(timezone.utc))
                    ))
                    if cur.rowcount > 0:
                        inserted_count += 1
                except Exception as e:
                    logger.error(f"Failed to insert article {article.get('url')}: {e}")
                    self.conn.rollback()
                    raise e
        self.conn.commit()
        logger.info(f"Inserted {inserted_count} new articles.")

    def update_clusters(self, clusters_data, articles_with_indices):
        try:
            with self.conn.cursor() as cur:
                # 1. Remove previous Cluster records.
                # Prisma has onDelete: SetNull on Article.clusterId, but to be explicit we can also do it.
                cur.execute('UPDATE "Article" SET "clusterId" = NULL')
                cur.execute('DELETE FROM "Cluster"')
                
                # 2. Insert newly calculated clusters and assign articles
                for cluster_info in clusters_data:
                    cluster_id = str(uuid.uuid4())
                    indices = cluster_info.pop('article_indices')
                    
                    cur.execute('''
                        INSERT INTO "Cluster" (id, label)
                        VALUES (%s, %s)
                    ''', (cluster_id, cluster_info['label']))
                    
                    # Update articles
                    article_ids = [articles_with_indices[idx]['id'] for idx in indices]
                    if article_ids:
                        # psycopg2 mogrify or ANY for array
                        cur.execute('''
                            UPDATE "Article" 
                            SET "clusterId" = %s 
                            WHERE id = ANY(%s)
                        ''', (cluster_id, article_ids))
                        
            self.conn.commit()
            logger.info(f"Re-created {len(clusters_data)} clusters and updated articles.")
        except Exception as e:
            self.conn.rollback()
            logger.error(f"Failed to update clusters: {e}")
            raise e
