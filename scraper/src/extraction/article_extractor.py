import logging
import threading
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit

import requests
import trafilatura
from bs4 import BeautifulSoup

from src.utils.text import WHITESPACE, strip_boilerplate

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "NewsPulseBot/1.0",
    "Accept": "text/html,application/xhtml+xml",
}

# Paywalled / bot-protected sites answer with these. We respect the refusal and
# fall back to the RSS headline + summary; nothing here tries to get around it.
BLOCKED_STATUSES = {401, 403, 429, 451}

# Shorter "bodies" are usually cookie notices or paywall teasers, not articles.
MIN_BODY_CHARS = 200

# Outcome of one extraction attempt.
EXTRACTED = "extracted"   # article text stored
BLOCKED = "blocked"       # site refused this request (401/403/429/451)
SKIPPED = "skipped"       # not requested: site already refused earlier in this run
FAILED = "failed"         # timeout, network error, 404/5xx, non-HTML response
EMPTY = "empty"           # page fetched but no usable article text found


class BlockedDomains:
    """
    Hosts that refused extraction during the current run. Shared by worker
    threads, so access is locked. Lives only as long as one run: every new
    ingestion tries each site again.
    """

    def __init__(self):
        self._hosts = set()
        self._lock = threading.Lock()

    def __contains__(self, host):
        with self._lock:
            return host in self._hosts

    def add(self, host):
        """Returns True the first time a host is added."""
        with self._lock:
            if host in self._hosts:
                return False
            self._hosts.add(host)
            return True


def extract_text(html):
    """Main article text from an HTML page, or '' if none can be found."""
    try:
        text = trafilatura.extract(html, include_comments=False, include_tables=False) or ""
    except Exception as e:  # trafilatura can raise on unusual markup
        logger.debug(f"[EXTRACT] trafilatura failed: {e}")
        text = ""

    if not text:
        # Fallback: paragraphs inside <article> only. Grabbing every <p> on
        # the page mostly collects navigation and footer text.
        article = BeautifulSoup(html, "html.parser").find("article")
        if article:
            text = "\n".join(p.get_text(" ", strip=True) for p in article.find_all("p"))

    text = strip_boilerplate(text)
    return text if len(WHITESPACE.sub(" ", text)) >= MIN_BODY_CHARS else ""


def extract_body(url, blocked_domains, timeout):
    """Returns (body or None, outcome). Never raises."""
    host = urlsplit(url).hostname or ""
    if host in blocked_domains:
        return None, SKIPPED

    try:
        response = requests.get(url, headers=HEADERS, timeout=timeout)
    except requests.RequestException as e:
        logger.warning(f"[EXTRACT] {host}: request failed ({type(e).__name__}) for {url}")
        return None, FAILED

    if response.status_code in BLOCKED_STATUSES:
        if blocked_domains.add(host):
            logger.warning(
                f"[EXTRACT] {host} returned HTTP {response.status_code}; "
                f"using RSS summary for its articles for the rest of this run"
            )
        return None, BLOCKED

    if response.status_code >= 400:
        logger.warning(f"[EXTRACT] {host}: HTTP {response.status_code} for {url}")
        return None, FAILED

    if "html" not in response.headers.get("Content-Type", "text/html").lower():
        return None, FAILED

    body = extract_text(response.text)
    return (body, EXTRACTED) if body else (None, EMPTY)


def extract_all(articles, concurrency, timeout):
    """
    Fills article["body"] for each article (None when unavailable) using a
    bounded thread pool, in two waves:

      1. one "probe" article per site, in parallel;
      2. every remaining article, in parallel. Sites that refused the probe
         are skipped without another request.

    Without the probe wave, several requests to a blocking site would already
    be in flight before its first 403 came back. Returns a Counter of outcomes.
    """
    outcomes = Counter()
    if not articles:
        return outcomes

    by_host = defaultdict(list)
    for article in articles:
        by_host[urlsplit(article["url"]).hostname].append(article)
    probes = [group[0] for group in by_host.values()]
    remaining = [a for group in by_host.values() for a in group[1:]]

    blocked_domains = BlockedDomains()
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        for wave in (probes, remaining):
            futures = [pool.submit(extract_body, a["url"], blocked_domains, timeout) for a in wave]
            # Results are written back here, on the main thread.
            for article, future in zip(wave, futures):
                body, outcome = future.result()
                article["body"] = body
                outcomes[outcome] += 1

    return outcomes
