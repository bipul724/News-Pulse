import unittest
from datetime import datetime, timezone
from src.grouping.clusterer import cluster_articles
from src.utils.dates import parse_date

class TestPipeline(unittest.TestCase):
    def test_date_parsing(self):
        # Valid standard date
        dt1 = parse_date("Sun, 22 Sep 2026 12:00:00 GMT")
        self.assertEqual(dt1.year, 2026)
        self.assertEqual(dt1.month, 9)
        self.assertEqual(dt1.day, 22)

        # Invalid date should fallback to current UTC
        dt2 = parse_date("Invalid Date String")
        self.assertTrue(isinstance(dt2, datetime))
        self.assertIsNotNone(dt2.tzinfo)

    def test_clustering_produces_expected_groups(self):
        articles = [
            {
                "_id": "1",
                "guid": "guid1",
                "title": "Apple releases new iPhone",
                "summary": "The tech giant announced its latest smartphone.",
                "content": "Full text about the new iPhone.",
                "publishedAt": datetime(2026, 9, 22, 10, 0, tzinfo=timezone.utc)
            },
            {
                "_id": "2",
                "guid": "guid2",
                "title": "New Apple iPhone 15 features",
                "summary": "Everything you need to know about the smartphone.",
                "content": "It has a better camera and screen.",
                "publishedAt": datetime(2026, 9, 22, 11, 0, tzinfo=timezone.utc)
            },
            {
                "_id": "3",
                "guid": "guid3",
                "title": "Fed raises interest rates again",
                "summary": "Central bank hikes rates by 25 basis points.",
                "content": "Inflation concerns drive the decision.",
                "publishedAt": datetime(2026, 9, 22, 9, 0, tzinfo=timezone.utc)
            }
        ]
        
        clusters = cluster_articles(articles)
        
        # We expect 2 clusters: [1, 2] (Apple/iPhone) and [3] (Fed/Rates)
        self.assertEqual(len(clusters), 2)
        
        # Let's verify the first cluster has 2 articles (iPhone ones)
        # Sort clusters by article count descending
        clusters = sorted(clusters, key=lambda x: x['articleCount'], reverse=True)
        
        self.assertEqual(clusters[0]['articleCount'], 2)
        self.assertEqual(clusters[1]['articleCount'], 1)
        
        # Verify the indices
        self.assertIn(0, clusters[0]['article_indices'])
        self.assertIn(1, clusters[0]['article_indices'])
        self.assertIn(2, clusters[1]['article_indices'])

if __name__ == '__main__':
    unittest.main()
