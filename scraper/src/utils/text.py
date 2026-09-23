import re

from bs4 import BeautifulSoup

# Page furniture that extraction sometimes keeps. It is shared by many articles
# from the same site, so leaving it in makes unrelated stories look similar.
BOILERPLATE_PATTERNS = [
    # BBC: everything from the "Related topics" block onwards.
    re.compile(r"\n\s*Related topics\b.*\Z", re.IGNORECASE | re.DOTALL),
    re.compile(r"Updates from your News topics will appear in My News and in a collection on the News homepage\.?", re.IGNORECASE),
]

WHITESPACE = re.compile(r"\s+")


def clean_html(raw_html):
    """Turns an HTML fragment (e.g. an RSS summary) into plain text."""
    if not raw_html:
        return ""
    text = BeautifulSoup(raw_html, "html.parser").get_text(separator=" ", strip=True)
    return WHITESPACE.sub(" ", text).strip()


def strip_boilerplate(text):
    if not text:
        return ""
    for pattern in BOILERPLATE_PATTERNS:
        text = pattern.sub(" ", text)
    return text.strip()
