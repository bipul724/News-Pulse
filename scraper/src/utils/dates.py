import calendar
import logging
import time
from datetime import datetime, timedelta, timezone

from dateutil import parser

logger = logging.getLogger(__name__)

# Feeds occasionally carry clock skew or a wrong timezone, putting items slightly
# in the future. Within this window the time is clamped to "now"; beyond it the
# date is treated as invalid.
MAX_FUTURE_SKEW = timedelta(hours=24)
EARLIEST_VALID = datetime(1990, 1, 1, tzinfo=timezone.utc)


def parse_date(value, now=None):
    """
    Converts an RSS/ISO date string or a feedparser time.struct_time into a
    timezone-aware UTC datetime. Returns None when the value is missing,
    malformed or unreasonable, so the caller decides the fallback.
    Naive timestamps are assumed to be UTC.
    """
    if not value:
        return None

    now = now or datetime.now(timezone.utc)

    try:
        if isinstance(value, time.struct_time):
            # feedparser's *_parsed fields are already normalized to UTC.
            dt = datetime.fromtimestamp(calendar.timegm(value), tz=timezone.utc)
        else:
            dt = parser.parse(str(value).strip())
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            dt = dt.astimezone(timezone.utc)
    except (ValueError, OverflowError, TypeError) as e:
        logger.warning(f"[RSS] Unparseable date {value!r}: {e}")
        return None

    if dt < EARLIEST_VALID:
        logger.warning(f"[RSS] Rejected implausible date {dt.isoformat()}")
        return None
    if dt > now + MAX_FUTURE_SKEW:
        logger.warning(f"[RSS] Rejected future date {dt.isoformat()}")
        return None
    if dt > now:
        return now
    return dt
