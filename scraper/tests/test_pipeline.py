import unittest
from collections import Counter
from datetime import datetime, timezone
from unittest.mock import patch

from src.main import PipelineError, main, run_pipeline
from src.rss.fetcher import FeedResult


def article(url, headline):
    return {"source": "BBC News", "headline": headline, "summary": "", "body": None, "url": url,
            "publishedAt": datetime(2026, 9, 22, tzinfo=timezone.utc)}


class FakeStorage:
    def __init__(self, existing_urls=(), unclustered=False):
        self.existing_urls = set(existing_urls)
        self.unclustered = unclustered
        self.inserted = []
        self.replaced = None

    def get_existing_urls(self):
        return set(self.existing_urls)

    def insert_articles(self, articles):
        self.inserted.extend(articles)
        return len(articles)

    def needs_recluster(self):
        return self.unclustered

    def get_articles_for_clustering(self, max_body_chars):
        return [dict(a, id=str(i)) for i, a in enumerate(self.inserted or [article("https://x.com/old", "Old")])]

    def replace_clusters(self, clusters, articles):
        self.replaced = (clusters, articles)


FEED_ARTICLES = [article("https://x.com/known", "Known story"), article("https://x.com/new", "New story")]


def fake_fetch(results_ok=True):
    result = FeedResult("https://x.com/rss", "BBC News", articles=FEED_ARTICLES)
    if not results_ok:
        result = FeedResult("https://x.com/rss", "x.com", error="download failed")
    return lambda urls: ((FEED_ARTICLES if results_ok else []), [result])


@patch("src.main.extract_all", return_value=Counter({"extracted": 1}))
class TestRunPipeline(unittest.TestCase):
    def test_only_new_articles_are_extracted_and_inserted(self, extract):
        storage = FakeStorage(existing_urls={"https://x.com/known"})
        with patch("src.main.fetch_feeds", fake_fetch()):
            stats = run_pipeline(storage, ["https://x.com/rss"])

        extracted = extract.call_args.args[0]
        self.assertEqual([a["url"] for a in extracted], ["https://x.com/new"])
        self.assertEqual([a["url"] for a in storage.inserted], ["https://x.com/new"])
        self.assertEqual((stats.fetched, stats.already_known, stats.inserted), (2, 1, 1))
        self.assertIsNotNone(storage.replaced)
        self.assertEqual(stats.clusters, 1)

    def test_rerun_with_nothing_new_skips_extraction_and_clustering(self, extract):
        storage = FakeStorage(existing_urls={"https://x.com/known", "https://x.com/new"})
        with patch("src.main.fetch_feeds", fake_fetch()):
            stats = run_pipeline(storage, ["https://x.com/rss"])

        extract.assert_not_called()
        self.assertEqual(storage.inserted, [])
        self.assertIsNone(storage.replaced)
        self.assertIsNone(stats.clusters)

    def test_unclustered_articles_trigger_a_rebuild_even_without_new_ones(self, extract):
        storage = FakeStorage(existing_urls={"https://x.com/known", "https://x.com/new"}, unclustered=True)
        with patch("src.main.fetch_feeds", fake_fetch()):
            stats = run_pipeline(storage, ["https://x.com/rss"])
        self.assertIsNotNone(storage.replaced)
        self.assertEqual(stats.recluster_reason, "unclustered articles found")

    def test_force_recluster(self, extract):
        storage = FakeStorage(existing_urls={"https://x.com/known", "https://x.com/new"})
        with patch("src.main.fetch_feeds", fake_fetch()):
            run_pipeline(storage, ["https://x.com/rss"], force_recluster=True)
        self.assertIsNotNone(storage.replaced)

    def test_all_feeds_failing_fails_the_run(self, extract):
        with patch("src.main.fetch_feeds", fake_fetch(results_ok=False)):
            with self.assertRaises(PipelineError):
                run_pipeline(FakeStorage(), ["https://x.com/rss"])


class TestMain(unittest.TestCase):
    @patch("src.main.PostgresStorage")
    def test_database_failure_exits_non_zero(self, storage_class):
        storage_class.return_value.__enter__.side_effect = RuntimeError("could not connect")
        with self.assertLogs("src.main", level="ERROR"):
            self.assertEqual(main([]), 1)

    @patch("src.main.run_pipeline")
    @patch("src.main.PostgresStorage")
    def test_success_exits_zero_and_passes_flag(self, storage_class, run):
        from src.main import RunStats
        run.return_value = RunStats(feeds_total=1, feeds_ok=1)
        with self.assertLogs("src.main", level="INFO") as logs:
            self.assertEqual(main(["--force-recluster"]), 0)
        self.assertTrue(run.call_args.kwargs["force_recluster"])
        self.assertTrue(any("INGESTION SUMMARY" in line for line in logs.output))


if __name__ == "__main__":
    unittest.main()
