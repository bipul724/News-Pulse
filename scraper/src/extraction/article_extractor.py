import logging
import trafilatura
import requests
from bs4 import BeautifulSoup
from src.config import ARTICLE_TIMEOUT_SECONDS

logger = logging.getLogger(__name__)

def extract_article_body(url):
    """
    Attempts to extract the main body of an article from its URL.
    Returns the extracted text or an empty string on failure.
    """
    if not url:
        return ""
        
    try:
        # trafilatura fetch avoids some bot blocking and handles timeouts
        downloaded = trafilatura.fetch_url(url)
        if downloaded:
            text = trafilatura.extract(downloaded)
            if text:
                return text
                
        # Fallback to requests + BeautifulSoup
        response = requests.get(url, timeout=ARTICLE_TIMEOUT_SECONDS)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Simple extraction: grab all paragraphs
        paragraphs = soup.find_all('p')
        text = " ".join([p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)])
        return text

    except requests.RequestException as e:
        logger.warning(f"Network error extracting {url}: {e}")
    except Exception as e:
        logger.warning(f"Failed to extract body for {url}: {e}")
        
    return ""
