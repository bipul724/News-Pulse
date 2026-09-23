import os

from dotenv import load_dotenv

load_dotenv()

DEFAULT_FEEDS = (
    "http://feeds.bbci.co.uk/news/world/rss.xml,"
    "https://feeds.npr.org/1004/rss.xml,"
    "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"
)


def _number(name, default, cast, minimum):
    raw = os.getenv(name, str(default))
    try:
        value = cast(raw)
    except ValueError:
        raise ValueError(f"{name} must be a number, got {raw!r}") from None
    if value < minimum:
        raise ValueError(f"{name} must be >= {minimum}, got {value}")
    return value


DATABASE_URL = os.getenv("DATABASE_URL")
RSS_FEEDS = [url.strip() for url in os.getenv("RSS_FEEDS", DEFAULT_FEEDS).split(",") if url.strip()]

# Minimum average cosine similarity for two groups of articles to merge.
# 0.12 was chosen by scoring hand-labelled real articles; see README.
SIMILARITY_THRESHOLD = _number("SIMILARITY_THRESHOLD", 0.12, float, 0.0)

ARTICLE_TIMEOUT_SECONDS = _number("ARTICLE_TIMEOUT_SECONDS", 10, float, 1)
EXTRACTION_CONCURRENCY = _number("EXTRACTION_CONCURRENCY", 5, int, 1)

# How many characters of each article body feed the clustering text. News leads
# carry the key facts; longer bodies scored worse in testing (see README).
MAX_CLUSTER_TEXT_LENGTH = _number("MAX_CLUSTER_TEXT_LENGTH", 1000, int, 0)
