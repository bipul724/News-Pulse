import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
RSS_FEEDS = os.getenv("RSS_FEEDS", "http://feeds.bbci.co.uk/news/world/rss.xml,https://feeds.npr.org/1004/rss.xml,https://rss.nytimes.com/services/xml/rss/nyt/World.xml").split(",")
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.15"))
ARTICLE_TIMEOUT_SECONDS = int(os.getenv("ARTICLE_TIMEOUT_SECONDS", "10"))
