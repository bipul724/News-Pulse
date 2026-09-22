import sys
import logging
from src.config import RSS_FEEDS
from src.rss.fetcher import fetch_feeds
from src.extraction.article_extractor import extract_article_body
from src.grouping.clusterer import cluster_articles
from src.storage.postgres import PostgresStorage

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    try:
        logger.info("Starting ingestion pipeline...")
        storage = PostgresStorage()
        
        # 1. Fetch raw articles from RSS
        raw_articles = fetch_feeds(RSS_FEEDS)
        logger.info(f"Fetched {len(raw_articles)} total articles from RSS feeds.")
        
        # 2. Detect existing articles (duplicate prevention)
        existing_urls = storage.get_existing_urls()
        new_articles = [a for a in raw_articles if a['url'] not in existing_urls]
        logger.info(f"Found {len(new_articles)} new articles to process.")
        
        # 3. Extract body for new articles and insert them
        if new_articles:
            for article in new_articles:
                article['body'] = extract_article_body(article['url'])
                article['clusterId'] = None # Will be populated after clustering
            
            storage.insert_articles(new_articles)
        
        # 4. Fetch all articles from DB for clustering
        # This ensures new articles form clusters with old ones!
        all_articles = storage.get_all_articles()
        
        if not all_articles:
            logger.info("No articles in database to cluster. Exiting.")
            sys.exit(0)
            
        # 5. Topic Grouping
        clusters = cluster_articles(all_articles)
        
        # 6. Save clusters and update article clusterIds
        storage.update_clusters(clusters, all_articles)
        
        logger.info("Ingestion pipeline completed successfully.")
        sys.exit(0)

    except Exception as e:
        logger.error(f"Ingestion pipeline failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
