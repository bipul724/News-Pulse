import time
import unittest
from datetime import datetime, timedelta, timezone

from src.utils.dates import parse_date
from src.utils.urls import normalize_url

NOW = datetime(2026, 9, 23, 12, 0, tzinfo=timezone.utc)


class TestNormalizeUrl(unittest.TestCase):
    def test_trims_whitespace(self):
        self.assertEqual(normalize_url("  https://www.npr.org/2026/09/23/story  "), "https://www.npr.org/2026/09/23/story")

    def test_removes_trailing_slash_but_keeps_root(self):
        self.assertEqual(normalize_url("https://example.com/news/story/"), "https://example.com/news/story")
        self.assertEqual(normalize_url("https://example.com/"), "https://example.com/")
        self.assertEqual(normalize_url("https://example.com"), "https://example.com/")

    def test_strips_utm_and_bbc_tracking_parameters(self):
        self.assertEqual(
            normalize_url("https://www.bbc.co.uk/news/articles/ck62m1631d7po?at_medium=RSS&at_campaign=rss"),
            "https://www.bbc.co.uk/news/articles/ck62m1631d7po",
        )
        self.assertEqual(
            normalize_url("https://example.com/a?utm_source=rss&utm_medium=feed&UTM_Campaign=x"),
            "https://example.com/a",
        )

    def test_keeps_meaningful_parameters_in_stable_order(self):
        self.assertEqual(
            normalize_url("https://example.com/watch?v=abc&utm_source=x&page=2"),
            "https://example.com/watch?page=2&v=abc",
        )

    def test_lowercases_scheme_and_host_but_not_path(self):
        self.assertEqual(normalize_url("HTTPS://WWW.Example.COM/World/Story"), "https://www.example.com/World/Story")

    def test_drops_default_port_and_fragment(self):
        self.assertEqual(normalize_url("https://example.com:443/a#comments"), "https://example.com/a")
        self.assertEqual(normalize_url("https://example.com:8443/a"), "https://example.com:8443/a")

    def test_does_not_rewrite_http_to_https(self):
        self.assertEqual(normalize_url("http://example.com/a"), "http://example.com/a")

    def test_rejects_unusable_urls(self):
        for bad in (None, "", "   ", "not a url", "ftp://example.com/file", "mailto:news@example.com", "https://"):
            self.assertIsNone(normalize_url(bad), bad)

    def test_same_article_normalizes_identically(self):
        variants = [
            "https://www.bbc.co.uk/news/articles/x1?at_medium=RSS&at_campaign=rss",
            " https://WWW.BBC.CO.UK/news/articles/x1/ ",
            "https://www.bbc.co.uk/news/articles/x1#top",
        ]
        self.assertEqual(len({normalize_url(v) for v in variants}), 1)


class TestParseDate(unittest.TestCase):
    def test_rfc_822_date(self):
        self.assertEqual(parse_date("Tue, 22 Sep 2026 12:00:00 GMT", now=NOW), datetime(2026, 9, 22, 12, 0, tzinfo=timezone.utc))

    def test_iso_timestamp_with_z(self):
        self.assertEqual(parse_date("2026-09-22T10:30:00Z", now=NOW), datetime(2026, 9, 22, 10, 30, tzinfo=timezone.utc))

    def test_timezone_offset_is_converted_to_utc(self):
        dt = parse_date("Tue, 22 Sep 2026 08:00:00 -0400", now=NOW)
        self.assertEqual(dt, datetime(2026, 9, 22, 12, 0, tzinfo=timezone.utc))
        self.assertEqual(dt.utcoffset(), timedelta(0))
        dt = parse_date("2026-09-22T17:30:00+05:30", now=NOW)
        self.assertEqual(dt, datetime(2026, 9, 22, 12, 0, tzinfo=timezone.utc))

    def test_missing_timezone_is_assumed_utc(self):
        self.assertEqual(parse_date("2026-09-22 12:00:00", now=NOW), datetime(2026, 9, 22, 12, 0, tzinfo=timezone.utc))

    def test_feedparser_struct_time(self):
        struct = time.struct_time((2026, 9, 22, 12, 0, 0, 1, 265, 0))
        self.assertEqual(parse_date(struct, now=NOW), datetime(2026, 9, 22, 12, 0, tzinfo=timezone.utc))

    def test_missing_or_malformed_returns_none(self):
        for bad in (None, "", "Invalid Date String", "32/13/2026", "yesterday-ish"):
            self.assertIsNone(parse_date(bad, now=NOW), bad)

    def test_far_future_date_is_rejected(self):
        self.assertIsNone(parse_date("2027-01-01T00:00:00Z", now=NOW))

    def test_slightly_future_date_is_clamped_to_now(self):
        self.assertEqual(parse_date("2026-09-23T15:00:00Z", now=NOW), NOW)

    def test_implausibly_old_date_is_rejected(self):
        self.assertIsNone(parse_date("1970-01-01T00:00:00Z", now=NOW))


if __name__ == "__main__":
    unittest.main()
