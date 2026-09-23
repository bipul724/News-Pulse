"""
Optional live checks. Skipped unless RUN_INTEGRATION_TESTS=true, so the normal
unit test run never touches the network or the database.

    RUN_INTEGRATION_TESTS=true python3 -m unittest tests.test_integration -v

Both tests are read-only: nothing is inserted or rebuilt.
"""
import os
import unittest

from src.config import RSS_FEEDS
from src.rss.fetcher import fetch_feeds

LIVE = os.getenv("RUN_INTEGRATION_TESTS", "").lower() == "true"


@unittest.skipUnless(LIVE, "set RUN_INTEGRATION_TESTS=true to run live checks")
class TestLive(unittest.TestCase):
    def test_configured_feeds_return_usable_articles(self):
        articles, results = fetch_feeds(RSS_FEEDS)
        self.assertTrue(any(r.ok for r in results), [r.error for r in results])
        self.assertTrue(articles)
        for a in articles:
            self.assertTrue(a["headline"] and a["url"].startswith("http"))
            self.assertIsNotNone(a["publishedAt"].tzinfo)

    def test_database_is_reachable_and_consistent(self):
        from src.storage.postgres import PostgresStorage
        with PostgresStorage() as storage, storage.conn.cursor() as cur:
            cur.execute('SELECT count(*) AS n FROM "Article" a LEFT JOIN "Cluster" c ON c.id = a."clusterId" '
                        'WHERE a."clusterId" IS NOT NULL AND c.id IS NULL')
            self.assertEqual(cur.fetchone()["n"], 0, "articles point at clusters that do not exist")


if __name__ == "__main__":
    unittest.main()
