import logging
import psycopg
from psycopg.rows import dict_row
import uuid
from datetime import datetime, timezone
from src.config import DATABASE_URL

logger = logging.getLogger(__name__)

class PostgresStorage:
    def __init__(self):
        # psycopg 3 uses psycopg.connect
        self.conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
        self.conn.autocommit = False

    def __del__(self):
        if hasattr(self, 'conn') and self.conn:
            self.conn.close()

    def get_existing_urls(self):
        with self.conn.cursor() as cur:
            cur.execute('SELECT url FROM "Article"')
            return {row['url'] for row in cur.fetchall()}

    def get_all_articles(self):
        with self.conn.cursor() as cur:
            cur.execute('SELECT id, source, headline, summary, body, url, "publishedAt" FROM "Article"')
            return cur.fetchall()

    def insert_articles(self, articles_list):
        if not articles_list:
            return
            
        inserted_count = 0
        for article in articles_list:
            article_id = str(uuid.uuid4())
            try:
                with self.conn.cursor() as cur:
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
                self.conn.commit()
            except Exception as e:
                logger.error(f"Failed to insert article {article.get('url')}: {e}")
                self.conn.rollback()
        logger.info(f"Inserted {inserted_count} new articles.")

    def update_clusters(self, clusters_data, articles_with_indices):
        try:
            with self.conn.cursor() as cur:
                # TRANSACTIONAL REBUILD
                # 1. Set all Article.clusterId = NULL
                cur.execute('UPDATE "Article" SET "clusterId" = NULL')
                
                # 2. Delete existing Cluster rows
                cur.execute('DELETE FROM "Cluster"')
                
                # 3. Insert new Cluster rows and 4. Update Articles
                for cluster_info in clusters_data:
                    cluster_id = str(uuid.uuid4())
                    indices = cluster_info.pop('article_indices')
                    
                    # Insert Cluster
                    cur.execute('''
                        INSERT INTO "Cluster" (id, label)
                        VALUES (%s, %s)
                    ''', (cluster_id, cluster_info['label']))
                    
                    # Get IDs for the related articles
                    article_ids = [articles_with_indices[idx]['id'] for idx in indices]
                    if article_ids:
                        cur.execute('''
                            UPDATE "Article" 
                            SET "clusterId" = %s 
                            WHERE id = ANY(%s)
                        ''', (cluster_id, article_ids))
                        
            # Commit the transaction once everything succeeds
            self.conn.commit()
            logger.info(f"Re-created {len(clusters_data)} clusters and updated articles in a single transaction.")
        except Exception as e:
            self.conn.rollback()
            logger.error(f"Failed to update clusters. Transaction rolled back. Error: {e}")
            raise e
