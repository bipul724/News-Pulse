import logging
from urllib.parse import urlparse

import trafilatura
import requests
from bs4 import BeautifulSoup
from src.config import ARTICLE_TIMEOUT_SECONDS

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "NewsPulseBot/1.0",
    "Accept": "text/html,application/xhtml+xml",
}

# Paywalled / bot-protected sites answer with these. Nothing to retry: the
# RSS headline + summary are still stored and used for clustering.
BLOCKED_STATUSES = {401, 403, 429, 451}

# Hosts that refused us during this run, so we don't hit them once per article.
_blocked_hosts = set()


def extract_article_body(url):
    """
    Attempts to extract the main body of an article from its URL.
    Returns the extracted text or an empty string on failure.
    """
    if not url:
        return ""

    host = urlparse(url).netloc
    if host in _blocked_hosts:
        return ""

    try:
        response = requests.get(url, headers=HEADERS, timeout=ARTICLE_TIMEOUT_SECONDS)

        if response.status_code in BLOCKED_STATUSES:
            _blocked_hosts.add(host)
            logger.info(
                f"{host} blocks full-text extraction (HTTP {response.status_code}); "
                f"using RSS summary for its articles this run."
            )
            return ""

        response.raise_for_status()

        text = trafilatura.extract(response.text)
        if text:
            return text

        # Fallback: grab all paragraphs
        soup = BeautifulSoup(response.content, 'html.parser')
        paragraphs = soup.find_all('p')
        return " ".join([p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)])

    except requests.RequestException as e:
        logger.warning(f"Network error extracting {url}: {e}")
    except Exception as e:
        logger.warning(f"Failed to extract body for {url}: {e}")

    return ""
