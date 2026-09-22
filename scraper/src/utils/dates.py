from dateutil import parser
from datetime import datetime, timezone

def parse_date(date_string):
    if not date_string:
        return datetime.now(timezone.utc)
    try:
        dt = parser.parse(date_string)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return datetime.now(timezone.utc)
