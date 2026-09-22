import feedparser
import logging
from bs4 import BeautifulSoup
from src.utils.dates import parse_date

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def clean_html(raw_html):
    if not raw_html:
        return ""
    return BeautifulSoup(raw_html, "html.parser").get_text(separator=" ", strip=True)

def fetch_feeds(feed_urls):
    articles = []
    
    for url in feed_urls:
        logger.info(f"Fetching RSS feed: {url}")
        try:
            feed = feedparser.parse(url)
            source_name = feed.feed.get('title', 'Unknown Source')
            
            for entry in feed.entries:
                # Some feeds use 'id', some use 'guid', fallback to link
                guid = entry.get('id', entry.get('guid', entry.get('link')))
                if not guid:
                    continue
                    
                title = entry.get('title', 'No Title')
                link = entry.get('link', '')
                
                # Get summary (handle differences between feeds)
                summary_raw = entry.get('summary', entry.get('description', ''))
                summary = clean_html(summary_raw)
                
                # Get publication date
                published_raw = entry.get('published', entry.get('pubDate', ''))
                published_at = parse_date(published_raw)
                
                articles.append({
                    'guid': guid,
                    'headline': title,
                    'summary': summary,
                    'source': source_name,
                    'url': link,
                    'publishedAt': published_at
                })
        except Exception as e:
            logger.error(f"Failed to fetch or parse feed {url}: {e}")
            
    return articles
