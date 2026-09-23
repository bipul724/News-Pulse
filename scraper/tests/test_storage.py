import unittest
from unittest.mock import MagicMock, patch
from src.storage.postgres import PostgresStorage

class TestPostgresStorage(unittest.TestCase):
    @patch('src.storage.postgres.psycopg.connect')
    def test_insert_articles_duplicate_handling(self, mock_connect):
        # Mock connection and cursor
        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        
        storage = PostgresStorage()
        
        # Test inserting an article
        articles = [{
            'source': 'BBC',
            'headline': 'Test Headline',
            'summary': 'Test Summary',
            'body': 'Test Body',
            'url': 'http://test.com',
            'publishedAt': '2026-09-22T10:00:00Z'
        }]
        
        mock_cur.rowcount = 1
        storage.insert_articles(articles)
        
        # Verify execute was called with correct SQL
        call_args = mock_cur.execute.call_args[0]
        self.assertIn('ON CONFLICT (url) DO NOTHING', call_args[0])
        self.assertEqual(call_args[1][5], 'http://test.com')  # Check URL param
        
        mock_conn.commit.assert_called_once()
        
    @patch('src.storage.postgres.psycopg.connect')
    def test_update_clusters_transactional(self, mock_connect):
        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        
        storage = PostgresStorage()
        
        clusters_data = [{
            'label': 'Test Cluster',
            'article_indices': [0, 1]
        }]
        
        articles = [
            {'id': 'art1'},
            {'id': 'art2'}
        ]
        
        storage.update_clusters(clusters_data, articles)
        
        # Verify sequence of queries for transaction
        queries = [call[0][0] for call in mock_cur.execute.call_args_list]
        self.assertIn('UPDATE "Article" SET "clusterId" = NULL', queries[0])
        self.assertIn('DELETE FROM "Cluster"', queries[1])
        self.assertIn('INSERT INTO "Cluster"', queries[2])
        self.assertIn('UPDATE "Article"', queries[3])
        
        mock_conn.commit.assert_called_once()

    @patch('src.storage.postgres.psycopg.connect')
    def test_update_clusters_rollback(self, mock_connect):
        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        
        # Make the cursor execute raise an exception
        mock_cur.execute.side_effect = Exception("Database error")
        
        storage = PostgresStorage()
        
        with self.assertRaises(Exception):
            storage.update_clusters([{'label': 'a', 'article_indices': [0]}], [{'id': 'a'}])
            
        mock_conn.rollback.assert_called_once()
        mock_conn.commit.assert_not_called()

if __name__ == '__main__':
    unittest.main()
