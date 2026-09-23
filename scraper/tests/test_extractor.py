import unittest
from unittest.mock import MagicMock, patch

import requests

from src.extraction.article_extractor import (
    BLOCKED, EMPTY, EXTRACTED, FAILED, SKIPPED,
    BlockedDomains, extract_all, extract_body, extract_text,
)

PARAGRAPH = "The court convicted fifteen men over the Easter Sunday bombings that killed hundreds of people in churches and hotels. "
PARAGRAPHS = [
    PARAGRAPH,
    "Prosecutors said the attackers were members of a local Islamist group that planned the strikes for months.",
    "Relatives of the victims gathered outside the court in Colombo as the judges read out the verdict on Tuesday.",
]
ARTICLE_HTML = f"""<html><head><title>Story</title></head><body>
<nav>Home | World | Business</nav>
<article><h1>Sri Lanka court convicts 15</h1>{"".join(f"<p>{p}</p>" for p in PARAGRAPHS)}</article>
<footer>Copyright</footer></body></html>"""


def response(status=200, text="", content_type="text/html; charset=utf-8"):
    resp = MagicMock()
    resp.status_code = status
    resp.text = text
    resp.headers = {"Content-Type": content_type}
    return resp


class TestExtractText(unittest.TestCase):
    def test_extracts_article_text(self):
        text = extract_text(ARTICLE_HTML)
        self.assertIn("convicted fifteen men", text)
        self.assertNotIn("Copyright", text)

    def test_malformed_html_does_not_raise(self):
        self.assertEqual(extract_text("<html><body><div><p>unclosed <b>tags<article"), "")
        self.assertEqual(extract_text(""), "")

    def test_short_teaser_is_not_treated_as_an_article(self):
        self.assertEqual(extract_text("<html><body><article><p>Subscribe to read.</p></article></body></html>"), "")

    def test_bbc_related_topics_boilerplate_is_removed(self):
        with patch("src.extraction.article_extractor.trafilatura.extract",
                   return_value=" ".join(PARAGRAPHS) + "\nRelated topics\n- ChinaUpdates from your News topics will appear in My News and in a collection on the News homepage."):
            text = extract_text("<html></html>")
        self.assertIn("convicted", text)
        self.assertNotIn("Related topics", text)
        self.assertNotIn("My News", text)


@patch("src.extraction.article_extractor.requests.get")
class TestExtractBody(unittest.TestCase):
    def test_successful_article(self, get):
        get.return_value = response(200, ARTICLE_HTML)
        body, outcome = extract_body("https://www.bbc.co.uk/news/a", BlockedDomains(), timeout=10)
        self.assertEqual(outcome, EXTRACTED)
        self.assertIn("Easter Sunday bombings", body)
        self.assertEqual(get.call_args.kwargs["timeout"], 10)

    def test_403_marks_domain_blocked_and_later_articles_are_not_requested(self, get):
        get.return_value = response(403)
        blocked = BlockedDomains()

        first = extract_body("https://www.nytimes.com/a", blocked, timeout=10)
        second = extract_body("https://www.nytimes.com/b", blocked, timeout=10)
        other_site = extract_body("https://www.npr.org/c", blocked, timeout=10)

        self.assertEqual(first, (None, BLOCKED))
        self.assertEqual(second, (None, SKIPPED))
        self.assertEqual(other_site, (None, BLOCKED))   # npr also got 403 from the mock
        self.assertEqual(get.call_count, 2)             # nytimes.com/b was never requested

    def test_404_fails_without_blocking_the_domain(self, get):
        get.return_value = response(404)
        blocked = BlockedDomains()
        self.assertEqual(extract_body("https://www.npr.org/gone", blocked, timeout=10), (None, FAILED))
        self.assertNotIn("www.npr.org", blocked)

    def test_timeout_is_a_failure_not_a_crash(self, get):
        get.side_effect = requests.Timeout("read timed out")
        self.assertEqual(extract_body("https://slow.example.com/a", BlockedDomains(), timeout=1), (None, FAILED))

    def test_non_html_response_is_a_failure(self, get):
        get.return_value = response(200, "%PDF-1.7", content_type="application/pdf")
        self.assertEqual(extract_body("https://example.com/report.pdf", BlockedDomains(), timeout=10), (None, FAILED))

    def test_page_without_article_text_is_empty(self, get):
        get.return_value = response(200, "<html><body><nav>Menu</nav></body></html>")
        self.assertEqual(extract_body("https://example.com/video", BlockedDomains(), timeout=10), (None, EMPTY))


@patch("src.extraction.article_extractor.requests.get")
class TestExtractAll(unittest.TestCase):
    def test_fills_bodies_and_falls_back_to_none(self, get):
        def fake_get(url, **kwargs):
            if "nytimes" in url:
                return response(403)
            if "timeout" in url:
                raise requests.Timeout()
            return response(200, ARTICLE_HTML)
        get.side_effect = fake_get

        articles = [
            {"url": "https://www.bbc.co.uk/news/1", "summary": "s"},
            {"url": "https://www.nytimes.com/1", "summary": "s"},
            {"url": "https://www.npr.org/timeout", "summary": "s"},
            {"url": "https://www.bbc.co.uk/news/2", "summary": "s"},
        ]
        outcomes = extract_all(articles, concurrency=3, timeout=5)

        self.assertIn("convicted", articles[0]["body"])
        self.assertIsNone(articles[1]["body"])
        self.assertIsNone(articles[2]["body"])
        self.assertIn("convicted", articles[3]["body"])
        self.assertEqual(outcomes[EXTRACTED], 2)
        self.assertEqual(outcomes[BLOCKED], 1)
        self.assertEqual(outcomes[FAILED], 1)
        self.assertEqual(sum(outcomes.values()), len(articles))

    def test_blocking_site_gets_one_request_per_run(self, get):
        requested = []
        def fake_get(url, **kwargs):
            requested.append(url)
            return response(403) if "nytimes" in url else response(200, ARTICLE_HTML)
        get.side_effect = fake_get

        articles = [{"url": f"https://www.nytimes.com/{i}"} for i in range(4)] + [{"url": "https://www.bbc.co.uk/news/1"}]
        outcomes = extract_all(articles, concurrency=5, timeout=5)

        self.assertEqual([u for u in requested if "nytimes" in u], ["https://www.nytimes.com/0"])
        self.assertEqual((outcomes[BLOCKED], outcomes[SKIPPED], outcomes[EXTRACTED]), (1, 3, 1))
        self.assertTrue(all(a["body"] is None for a in articles[:4]))

    def test_uses_a_bounded_thread_pool(self, get):
        get.return_value = response(200, ARTICLE_HTML)
        with patch("src.extraction.article_extractor.ThreadPoolExecutor") as pool_class:
            pool = pool_class.return_value.__enter__.return_value
            pool.submit.side_effect = lambda fn, *args: MagicMock(result=lambda: fn(*args))
            extract_all([{"url": "https://a.com/1"}], concurrency=4, timeout=5)
        pool_class.assert_called_once_with(max_workers=4)

    def test_nothing_to_do(self, get):
        self.assertEqual(sum(extract_all([], concurrency=5, timeout=5).values()), 0)
        get.assert_not_called()


if __name__ == "__main__":
    unittest.main()
