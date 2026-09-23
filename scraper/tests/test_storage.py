import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from src.storage.postgres import PostgresStorage


def make_storage(mock_connect):
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    mock_connect.return_value = conn
    storage = PostgresStorage(database_url="postgresql://test").__enter__()
    return storage, conn, cur


def executed_sql(cur):
    return [call.args[0] for call in cur.execute.call_args_list]


ARTICLE = {
    "source": "BBC News", "headline": "Headline", "summary": "Summary", "body": None,
    "url": "https://www.bbc.co.uk/news/articles/abc",
    "publishedAt": datetime(2026, 9, 22, 10, 0, tzinfo=timezone.utc),
}


@patch("src.storage.postgres.psycopg.connect")
class TestConnection(unittest.TestCase):
    def test_session_is_pinned_to_utc_and_connection_closed_on_exit(self, connect):
        conn = MagicMock()
        connect.return_value = conn
        with PostgresStorage(database_url="postgresql://test"):
            pass
        conn.execute.assert_called_once_with("SET TIME ZONE 'UTC'")
        conn.close.assert_called_once()
        self.assertTrue(connect.call_args.kwargs["autocommit"])

    def test_missing_database_url_fails_fast(self, connect):
        with self.assertRaises(RuntimeError):
            PostgresStorage(database_url="")


@patch("src.storage.postgres.psycopg.connect")
class TestInsertArticles(unittest.TestCase):
    def test_single_batched_insert_with_on_conflict(self, connect):
        storage, conn, cur = make_storage(connect)
        cur.fetchall.return_value = [{"url": ARTICLE["url"]}]

        inserted = storage.insert_articles([ARTICLE, dict(ARTICLE, url="https://www.bbc.co.uk/news/articles/def")])

        self.assertEqual(cur.execute.call_count, 1)  # one round trip for the whole batch
        sql, params = cur.execute.call_args.args
        self.assertIn("ON CONFLICT (url) DO NOTHING", sql)
        self.assertIn("RETURNING url", sql)
        self.assertEqual(params[5], [ARTICLE["url"], "https://www.bbc.co.uk/news/articles/def"])
        self.assertEqual(params[4], [None, None])  # unavailable bodies are stored as NULL
        self.assertEqual(inserted, 1)              # count comes from RETURNING, not from input size
        conn.transaction.assert_called_once()

    def test_empty_batch_does_nothing(self, connect):
        storage, conn, cur = make_storage(connect)
        self.assertEqual(storage.insert_articles([]), 0)
        cur.execute.assert_not_called()

    def test_database_error_propagates_and_transaction_sees_it(self, connect):
        storage, conn, cur = make_storage(connect)
        cur.execute.side_effect = RuntimeError("connection lost")
        with self.assertRaises(RuntimeError):
            storage.insert_articles([ARTICLE])
        exit_args = conn.transaction.return_value.__exit__.call_args.args
        self.assertIs(exit_args[0], RuntimeError)   # the transaction block rolls back on exceptions


@patch("src.storage.postgres.psycopg.connect")
class TestExistingUrls(unittest.TestCase):
    def test_stored_urls_are_normalized_for_comparison(self, connect):
        storage, conn, cur = make_storage(connect)
        cur.__iter__.return_value = iter([
            {"url": "https://www.bbc.co.uk/news/articles/abc?at_medium=RSS&at_campaign=rss"},
            {"url": "https://www.npr.org/2026/09/23/story"},
        ])
        self.assertEqual(storage.get_existing_urls(), {
            "https://www.bbc.co.uk/news/articles/abc",
            "https://www.npr.org/2026/09/23/story",
        })


@patch("src.storage.postgres.psycopg.connect")
class TestReplaceClusters(unittest.TestCase):
    ARTICLES = [{"id": "art1"}, {"id": "art2"}, {"id": "art3"}]
    CLUSTERS = [
        {"label": "Sri Lanka verdict", "article_indices": [0, 2]},
        {"label": "Fed rates", "article_indices": [1]},
    ]

    def test_rebuild_runs_in_order_inside_one_transaction(self, connect):
        storage, conn, cur = make_storage(connect)
        cur.rowcount = 3

        storage.replace_clusters(self.CLUSTERS, self.ARTICLES)

        sql = executed_sql(cur)
        self.assertIn("pg_advisory_xact_lock", sql[0])
        self.assertIn('UPDATE "Article" SET "clusterId" = NULL', sql[1])
        self.assertIn('DELETE FROM "Cluster"', sql[2])
        self.assertIn('INSERT INTO "Cluster"', sql[3])
        self.assertIn('UPDATE "Article" AS a', sql[4])
        self.assertEqual(len(sql), 5)
        conn.transaction.assert_called_once()
        self.assertIsNone(conn.transaction.return_value.__exit__.call_args.args[0])  # committed

    def test_articles_are_assigned_to_their_cluster(self, connect):
        storage, conn, cur = make_storage(connect)
        cur.rowcount = 3

        storage.replace_clusters(self.CLUSTERS, self.ARTICLES)

        cluster_ids, labels = cur.execute.call_args_list[3].args[1]
        article_ids, assigned = cur.execute.call_args_list[4].args[1]
        self.assertEqual(labels, ["Sri Lanka verdict", "Fed rates"])
        self.assertEqual(article_ids, ["art1", "art3", "art2"])
        self.assertEqual(assigned, [cluster_ids[0], cluster_ids[0], cluster_ids[1]])

    def test_partial_assignment_rolls_back(self, connect):
        storage, conn, cur = make_storage(connect)
        cur.rowcount = 2  # one article vanished

        with self.assertRaises(RuntimeError):
            storage.replace_clusters(self.CLUSTERS, self.ARTICLES)
        self.assertIs(conn.transaction.return_value.__exit__.call_args.args[0], RuntimeError)

    def test_sql_error_rolls_back(self, connect):
        storage, conn, cur = make_storage(connect)
        cur.execute.side_effect = RuntimeError("Database error")

        with self.assertRaises(RuntimeError):
            storage.replace_clusters(self.CLUSTERS, self.ARTICLES)
        self.assertIs(conn.transaction.return_value.__exit__.call_args.args[0], RuntimeError)

    def test_article_in_two_clusters_is_rejected_before_touching_the_database(self, connect):
        storage, conn, cur = make_storage(connect)
        bad = [{"label": "a", "article_indices": [0]}, {"label": "b", "article_indices": [0]}]
        with self.assertRaises(ValueError):
            storage.replace_clusters(bad, self.ARTICLES)
        cur.execute.assert_not_called()


if __name__ == "__main__":
    unittest.main()
