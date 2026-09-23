from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# Query parameters that only track where a click came from. Removing them never
# changes which article a URL points to. Anything not listed here is preserved.
TRACKING_PREFIXES = ("utm_",)
TRACKING_KEYS = {
    "at_medium", "at_campaign",  # BBC RSS links
    "smid",                      # NYT share links
    "fbclid", "gclid", "cmpid",
}

DEFAULT_PORTS = {"http": 80, "https": 443}


def _is_tracking(key):
    key = key.lower()
    return key in TRACKING_KEYS or key.startswith(TRACKING_PREFIXES)


def normalize_url(url):
    """
    Returns a canonical form of an article URL, or None if it is not a usable
    http(s) URL. The same article must always normalize to the same string,
    because this value is what duplicate detection compares.
    """
    if not url or not isinstance(url, str):
        return None

    parts = urlsplit(url.strip())
    scheme = parts.scheme.lower()
    if scheme not in DEFAULT_PORTS or not parts.hostname:
        return None

    host = parts.hostname.lower()
    if parts.port and parts.port != DEFAULT_PORTS[scheme]:
        host = f"{host}:{parts.port}"

    path = parts.path or "/"
    if len(path) > 1:
        path = path.rstrip("/")

    query_pairs = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if not _is_tracking(k)]
    query = urlencode(sorted(query_pairs))

    # The fragment only scrolls within a page, so it is dropped.
    return urlunsplit((scheme, host, path, query, ""))
