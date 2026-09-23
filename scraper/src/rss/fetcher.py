import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from urllib.parse import urlsplit

import feedparser
import requests

from src.utils.dates import parse_date
from src.utils.text import WHITESPACE, clean_html
from src.utils.urls import normalize_url

logger = logging.getLogger(__name__)

FEED_TIMEOUT_SECONDS = 15
# content:encoded can hold a whole article; a summary only needs the opening.
MAX_SUMMARY_CHARS = 500
HEADERS = {"User-Agent": "NewsPulseBot/1.0"}


@dataclass
class FeedResult:
    url: str
    source: str
    articles: list = field(default_factory=list)
    skipped: int = 0          # items missing a title or usable URL
    date_fallbacks: int = 0   # items stored with the fetch time as publishedAt
    error: str = None         # set when the whole feed failed

    @property
    def ok(self):
        return self.error is None


def source_name(feed_title, feed_url):
    """
    The feed's own title is the source name. It must stay stable across runs,
    because existing Article rows are grouped and filtered by it.
    """
    title = WHITESPACE.sub(" ", feed_title or "").strip()
    return title or urlsplit(feed_url).hostname or "Unknown source"


def entry_summary(entry):
    """
    The item's short description. Feeds differ: most use <description>
    (feedparser: `summary`), some only fill <content:encoded> (feedparser:
    `content`). NPR puts a longer HTML intro there; NYT often puts a photo
    caption. Either is real publisher text, used only when <description> is empty.
    """
    summary = clean_html(entry.get("summary") or entry.get("description") or "")
    if summary:
        return summary
    for block in entry.get("content") or []:
        text = clean_html(block.get("value", ""))
        if text:
            return shorten_text(text, MAX_SUMMARY_CHARS)
    return ""


def shorten_text(text, limit):
    if len(text) <= limit:
        return text
    return text[: limit - 1].rsplit(" ", 1)[0].rstrip(" ,;:") + "…"


def parse_entry(entry, source, fetched_at):
    """
    Converts one feed entry into an article dict, or returns (None, reason)
    when the entry cannot be used. Never raises for missing fields.
    """
    headline = WHITESPACE.sub(" ", clean_html(entry.get("title", ""))).strip()
    if not headline:
        return None, "missing title"

    url = normalize_url(entry.get("link"))
    if not url:
        return None, "missing or invalid URL"

    published_at = None
    date_fallback = False
    for key in ("published_parsed", "updated_parsed", "published", "updated"):
        published_at = parse_date(entry.get(key), now=fetched_at)
        if published_at:
            break
    if not published_at:
        # The item is in the live feed right now, so the fetch time is a close,
        # clearly-logged approximation. Dropping real news would be worse.
        published_at = fetched_at
        date_fallback = True

    article = {
        "source": source,
        "headline": headline,
        "summary": entry_summary(entry),
        "url": url,
        "publishedAt": published_at,
        "body": None,
    }
    return article, "date fallback" if date_fallback else None


def fetch_feed(feed_url, timeout=FEED_TIMEOUT_SECONDS):
    """Downloads and parses one feed. Failures are recorded, never raised."""
    fallback_name = urlsplit(feed_url).hostname or feed_url
    try:
        response = requests.get(feed_url, headers=HEADERS, timeout=timeout)
        response.raise_for_status()
    except requests.RequestException as e:
        return FeedResult(feed_url, fallback_name, error=f"download failed: {e}")

    parsed = feedparser.parse(response.content)
    if not parsed.entries:
        reason = f"malformed feed: {parsed.get('bozo_exception')}" if parsed.bozo else "feed has no items"
        return FeedResult(feed_url, fallback_name, error=reason)

    result = FeedResult(feed_url, source_name(parsed.feed.get("title"), feed_url))
    fetched_at = datetime.now(timezone.utc)

    for entry in parsed.entries:
        try:
            article, note = parse_entry(entry, result.source, fetched_at)
        except Exception as e:  # one malformed item must not lose the rest of the feed
            logger.warning(f"[RSS] {result.source}: skipped malformed item: {e}")
            result.skipped += 1
            continue

        if article is None:
            result.skipped += 1
            logger.debug(f"[RSS] {result.source}: skipped item ({note})")
            continue
        if note == "date fallback":
            result.date_fallbacks += 1
        result.articles.append(article)

    return result


def fetch_feeds(feed_urls):
    """
    Fetches every feed independently. Returns (articles, feed_results).
    Articles are de-duplicated by normalized URL, since the same story can
    appear in more than one feed.
    """
    results = []
    articles = []
    seen_urls = set()

    for feed_url in feed_urls:
        result = fetch_feed(feed_url)
        results.append(result)

        if not result.ok:
            logger.error(f"[RSS] {result.source}: FAILED ({result.error})")
            continue

        new_here = 0
        for article in result.articles:
            if article["url"] not in seen_urls:
                seen_urls.add(article["url"])
                articles.append(article)
                new_here += 1

        details = []
        if result.skipped:
            details.append(f"{result.skipped} unusable items skipped")
        if result.date_fallbacks:
            details.append(f"{result.date_fallbacks} without a valid date used fetch time")
        if new_here < len(result.articles):
            details.append(f"{len(result.articles) - new_here} already seen in another feed")
        suffix = f" ({'; '.join(details)})" if details else ""
        logger.info(f"[RSS] {result.source}: {len(result.articles)} items{suffix}")

    return articles, results
