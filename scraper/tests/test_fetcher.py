import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import requests

from src.rss.fetcher import MAX_SUMMARY_CHARS, entry_summary, fetch_feed, fetch_feeds, parse_entry, source_name

FETCHED_AT = datetime(2026, 9, 23, 12, 0, tzinfo=timezone.utc)

RSS = b"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
  <title>  BBC News  </title>
  <item>
    <title>Sri Lanka court convicts 15 over Easter bombings</title>
    <link>https://www.bbc.co.uk/news/articles/abc?at_medium=RSS&amp;at_campaign=rss</link>
    <description>&lt;p&gt;A court has &lt;b&gt;convicted&lt;/b&gt; 15 men.&lt;/p&gt;</description>
    <pubDate>Tue, 22 Sep 2026 10:00:00 GMT</pubDate>
  </item>
  <item>
    <title></title>
    <link>https://www.bbc.co.uk/news/articles/no-title</link>
  </item>
  <item>
    <title>Item without a link</title>
  </item>
  <item>
    <title>Item with only content:encoded</title>
    <link>https://www.bbc.co.uk/news/articles/content-only</link>
    <content:encoded><![CDATA[<p>Body text supplied only as <b>content:encoded</b>.</p>]]></content:encoded>
    <pubDate>Tue, 22 Sep 2026 11:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Item with a broken date</title>
    <link>https://www.bbc.co.uk/news/articles/bad-date</link>
    <pubDate>not a date</pubDate>
  </item>
</channel></rss>"""


def response(content=b"", status=200):
    resp = MagicMock()
    resp.content = content
    resp.status_code = status
    resp.raise_for_status.side_effect = requests.HTTPError(f"{status} error") if status >= 400 else None
    return resp


class TestParseEntry(unittest.TestCase):
    def test_valid_item(self):
        entry = {
            "title": "  Sri Lanka convicts 15 ",
            "link": "https://www.bbc.co.uk/news/articles/abc?at_medium=RSS",
            "summary": "<p>A <b>court</b> ruled.</p>",
            "published": "Tue, 22 Sep 2026 10:00:00 GMT",
        }
        article, note = parse_entry(entry, "BBC News", FETCHED_AT)
        self.assertIsNone(note)
        self.assertEqual(article["headline"], "Sri Lanka convicts 15")
        self.assertEqual(article["url"], "https://www.bbc.co.uk/news/articles/abc")
        self.assertEqual(article["summary"], "A court ruled.")
        self.assertEqual(article["publishedAt"], datetime(2026, 9, 22, 10, 0, tzinfo=timezone.utc))
        self.assertEqual(article["source"], "BBC News")
        self.assertIsNone(article["body"])

    def test_missing_title_or_url_is_skipped(self):
        self.assertEqual(parse_entry({"link": "https://x.com/a"}, "S", FETCHED_AT), (None, "missing title"))
        self.assertEqual(parse_entry({"title": "T"}, "S", FETCHED_AT), (None, "missing or invalid URL"))
        self.assertEqual(parse_entry({"title": "T", "link": "javascript:void(0)"}, "S", FETCHED_AT), (None, "missing or invalid URL"))

    def test_missing_date_falls_back_to_fetch_time_and_says_so(self):
        article, note = parse_entry({"title": "T", "link": "https://x.com/a"}, "S", FETCHED_AT)
        self.assertEqual(article["publishedAt"], FETCHED_AT)
        self.assertEqual(note, "date fallback")

    def test_updated_date_is_used_when_published_is_missing(self):
        article, note = parse_entry({"title": "T", "link": "https://x.com/a", "updated": "2026-09-21T08:00:00Z"}, "S", FETCHED_AT)
        self.assertEqual(article["publishedAt"], datetime(2026, 9, 21, 8, 0, tzinfo=timezone.utc))
        self.assertIsNone(note)


class TestEntrySummary(unittest.TestCase):
    def test_description_is_preferred(self):
        entry = {"summary": "<p>Short description.</p>", "content": [{"value": "<p>Much longer body text.</p>"}]}
        self.assertEqual(entry_summary(entry), "Short description.")

    def test_content_encoded_is_used_when_description_is_missing(self):
        # NYT-style item: no <description>, only <content:encoded>.
        entry = {"content": [{"value": "<p>Prime Minister Sanae Takaichi of Japan was expected to meet with President Trump.</p>"}]}
        self.assertEqual(entry_summary(entry), "Prime Minister Sanae Takaichi of Japan was expected to meet with President Trump.")

    def test_long_content_encoded_is_cut_on_a_word_boundary(self):
        entry = {"content": [{"value": "<p>" + "word " * 300 + "</p>"}]}
        summary = entry_summary(entry)
        self.assertLessEqual(len(summary), MAX_SUMMARY_CHARS)
        self.assertTrue(summary.endswith("word…"))

    def test_empty_content_blocks_are_skipped(self):
        entry = {"content": [{"value": "<p> </p>"}, {"value": "Second block text."}]}
        self.assertEqual(entry_summary(entry), "Second block text.")

    def test_neither_field_gives_empty_summary(self):
        self.assertEqual(entry_summary({"title": "Here's the latest."}), "")


class TestSourceName(unittest.TestCase):
    def test_uses_trimmed_feed_title(self):
        self.assertEqual(source_name("  NYT >  World News ", "https://rss.nytimes.com/x.xml"), "NYT > World News")

    def test_falls_back_to_host_when_title_missing(self):
        self.assertEqual(source_name(None, "https://feeds.npr.org/1004/rss.xml"), "feeds.npr.org")


class TestFetchFeed(unittest.TestCase):
    @patch("src.rss.fetcher.requests.get")
    def test_parses_feed_and_skips_unusable_items(self, get):
        get.return_value = response(RSS)
        result = fetch_feed("https://feeds.bbci.co.uk/news/world/rss.xml")

        self.assertTrue(result.ok)
        self.assertEqual(result.source, "BBC News")
        self.assertEqual([a["url"] for a in result.articles], [
            "https://www.bbc.co.uk/news/articles/abc",
            "https://www.bbc.co.uk/news/articles/content-only",
            "https://www.bbc.co.uk/news/articles/bad-date",
        ])
        self.assertEqual(result.articles[1]["summary"], "Body text supplied only as content:encoded.")
        self.assertEqual(result.skipped, 2)          # no title, no link
        self.assertEqual(result.date_fallbacks, 1)   # "not a date"
        self.assertEqual(result.articles[0]["summary"], "A court has convicted 15 men.")
        self.assertEqual(get.call_args.kwargs["timeout"], 15)

    @patch("src.rss.fetcher.requests.get")
    def test_http_error_marks_feed_failed(self, get):
        get.return_value = response(status=503)
        result = fetch_feed("https://example.com/rss")
        self.assertFalse(result.ok)
        self.assertIn("download failed", result.error)

    @patch("src.rss.fetcher.requests.get", side_effect=requests.Timeout("timed out"))
    def test_timeout_marks_feed_failed(self, get):
        self.assertFalse(fetch_feed("https://example.com/rss").ok)

    @patch("src.rss.fetcher.requests.get")
    def test_malformed_xml_marks_feed_failed(self, get):
        get.return_value = response(b"<html><body>Service unavailable</body>")
        result = fetch_feed("https://example.com/rss")
        self.assertFalse(result.ok)

    @patch("src.rss.fetcher.parse_entry")
    @patch("src.rss.fetcher.requests.get")
    def test_exception_in_one_item_does_not_lose_the_feed(self, get, parse):
        get.return_value = response(RSS)
        good = {"url": "https://x.com/ok", "headline": "ok"}
        parse.side_effect = [RuntimeError("boom"), (good, None), (None, "missing title"), (dict(good, url="https://x.com/2"), None), (None, "missing title")]
        result = fetch_feed("https://example.com/rss")
        self.assertTrue(result.ok)
        self.assertEqual(len(result.articles), 2)
        self.assertEqual(result.skipped, 3)


class TestFetchFeeds(unittest.TestCase):
    @patch("src.rss.fetcher.requests.get")
    def test_one_failing_feed_does_not_stop_the_others(self, get):
        def fake_get(url, **kwargs):
            if "broken" in url:
                raise requests.ConnectionError("refused")
            return response(RSS)
        get.side_effect = fake_get

        articles, results = fetch_feeds(["https://broken.example.com/rss", "https://feeds.bbci.co.uk/rss"])

        self.assertEqual([r.ok for r in results], [False, True])
        self.assertEqual(len(articles), 3)

    @patch("src.rss.fetcher.requests.get")
    def test_same_article_in_two_feeds_is_kept_once(self, get):
        get.return_value = response(RSS)
        articles, _ = fetch_feeds(["https://a.example.com/rss", "https://b.example.com/rss"])
        self.assertEqual(len(articles), 3)
        self.assertEqual(len({a["url"] for a in articles}), 3)


if __name__ == "__main__":
    unittest.main()
