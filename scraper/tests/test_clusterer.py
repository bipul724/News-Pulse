import random
import unittest
from datetime import datetime, timezone

from src.grouping.clusterer import cluster_articles, prepare_document, shorten


def article(headline, summary="", body=""):
    return {"headline": headline, "summary": summary, "body": body,
            "publishedAt": datetime(2026, 9, 22, tzinfo=timezone.utc)}


SRI_LANKA = [
    article("Sri Lanka court convicts 15 over deadly 2019 Easter bombings",
            "A court in Colombo convicted fifteen men for the Easter Sunday attacks on churches and hotels."),
    article("Sri Lanka Convicts 15 in Easter 2019 Bomb Attacks",
            "The verdict comes years after suicide bombers struck churches and hotels in Sri Lanka."),
    article("Sri Lanka court convicts 15 men over deadly Easter Sunday bombings",
            "Judges in Colombo found fifteen men guilty over the Easter bombings."),
]
DIANA_BOOK = [
    article("Earl Spencer book blasts Diana's treatment by royal family",
            "Charles Spencer's memoir about his sister Princess Diana criticises the royal family."),
    article("Takeaways from Charles Spencer's memoir about Princess Diana",
            "The book by Diana's brother Charles Spencer revisits her treatment by the royals."),
]
UNRELATED = [
    article("Fed raises interest rates again", "The central bank lifted rates by a quarter point to fight inflation."),
    article("Typhoon grounds flights in Hong Kong", "Airlines cancelled hundreds of flights as the storm approached."),
    article("Chile wildfire contained after a week", "Firefighters brought the forest blaze under control near Valparaiso."),
]


def partition(articles, clusters):
    """Clusters as sets of headlines, independent of cluster/article order."""
    return {frozenset(articles[i]["headline"] for i in c["article_indices"]) for c in clusters}


class TestPrepareDocument(unittest.TestCase):
    def test_lowercases_and_strips_html_urls_and_punctuation(self):
        doc = prepare_document(article("Trump's U.N. Speech!", "<p>See https://example.com/x now.</p>"))
        self.assertEqual(doc, "trump s u n speech see now")

    def test_body_is_limited_to_the_lead(self):
        doc = prepare_document(article("Title", body="lead " * 50 + "tail " * 500), max_body_chars=100)
        self.assertIn("lead", doc)
        self.assertNotIn("tail", doc)

    def test_removes_bbc_boilerplate(self):
        body = "Real reporting here.\nRelated topics\n- ChinaUpdates from your News topics will appear in My News and in a collection on the News homepage."
        doc = prepare_document(article("T", body=body))
        self.assertIn("real reporting", doc)
        self.assertNotIn("homepage", doc)

    def test_missing_fields_give_empty_document(self):
        self.assertEqual(prepare_document({"headline": None, "summary": None, "body": None}), "")


class TestClusterArticles(unittest.TestCase):
    def test_same_topic_articles_are_grouped(self):
        clusters = cluster_articles(SRI_LANKA + UNRELATED, threshold=0.12)
        self.assertIn(frozenset(a["headline"] for a in SRI_LANKA), partition(SRI_LANKA + UNRELATED, clusters))

    def test_unrelated_articles_stay_apart(self):
        clusters = cluster_articles(UNRELATED, threshold=0.12)
        self.assertEqual(len(clusters), 3)
        self.assertTrue(all(c["articleCount"] == 1 for c in clusters))

    def test_two_stories_form_two_clusters(self):
        data = SRI_LANKA + DIANA_BOOK + UNRELATED
        groups = partition(data, cluster_articles(data, threshold=0.12))
        self.assertIn(frozenset(a["headline"] for a in SRI_LANKA), groups)
        self.assertIn(frozenset(a["headline"] for a in DIANA_BOOK), groups)
        self.assertEqual(len(groups), 2 + len(UNRELATED))

    def test_borderline_pair_depends_on_threshold(self):
        # Related theme (UN speeches) but different stories: moderate overlap.
        pair = [
            article("Macron criticizes Israel in final UN speech", "France's president addressed the General Assembly."),
            article("Burnham gives first UN speech as prime minister", "The UK leader addressed the General Assembly."),
        ]
        self.assertEqual(len(cluster_articles(pair, threshold=0.05)), 1)
        self.assertEqual(len(cluster_articles(pair, threshold=0.5)), 2)

    def test_single_article(self):
        clusters = cluster_articles([SRI_LANKA[0]])
        self.assertEqual(clusters, [{"label": SRI_LANKA[0]["headline"], "articleCount": 1, "article_indices": [0]}])

    def test_empty_input(self):
        self.assertEqual(cluster_articles([]), [])

    def test_article_without_body_still_clusters_on_headline_and_summary(self):
        data = [dict(a, body=None) for a in SRI_LANKA] + UNRELATED
        self.assertIn(frozenset(a["headline"] for a in SRI_LANKA), partition(data, cluster_articles(data, threshold=0.12)))

    def test_article_with_no_usable_text_is_kept_alone(self):
        data = SRI_LANKA + [article("!!!", "", "")]
        clusters = cluster_articles(data, threshold=0.12)
        lonely = [c for c in clusters if 3 in c["article_indices"]]
        self.assertEqual(lonely[0]["article_indices"], [3])

    def test_near_duplicate_headlines_are_grouped(self):
        data = [
            article("Eleven injured in shooting outside Turkish school"),
            article("Eleven injured in shooting outside a Turkish school"),
            UNRELATED[0],
        ]
        clusters = cluster_articles(data, threshold=0.12)
        self.assertIn([0, 1], [c["article_indices"] for c in clusters])

    def test_every_article_is_in_exactly_one_cluster(self):
        data = SRI_LANKA + DIANA_BOOK + UNRELATED
        indices = [i for c in cluster_articles(data) for i in c["article_indices"]]
        self.assertEqual(sorted(indices), list(range(len(data))))

    def test_result_does_not_depend_on_input_order(self):
        data = SRI_LANKA + DIANA_BOOK + UNRELATED
        expected = partition(data, cluster_articles(data, threshold=0.12))
        for seed in range(5):
            shuffled = data[:]
            random.Random(seed).shuffle(shuffled)
            self.assertEqual(partition(shuffled, cluster_articles(shuffled, threshold=0.12)), expected)

    def test_chain_is_not_merged_when_ends_are_unrelated(self):
        # A~B and B~C, but A and C share nothing. Average linkage only merges C
        # into {A, B} if C is similar to the group as a whole.
        a = article("alpha bravo charlie delta")
        b = article("alpha bravo echo foxtrot")
        c = article("echo foxtrot golf hotel")
        clusters = cluster_articles([a, b, c], threshold=0.3)
        self.assertEqual(sorted(len(x["article_indices"]) for x in clusters), [1, 2])


class TestLabels(unittest.TestCase):
    def test_label_is_the_most_representative_member_headline(self):
        data = SRI_LANKA + UNRELATED
        clusters = cluster_articles(data, threshold=0.12)
        label = next(c["label"] for c in clusters if c["articleCount"] == 3)
        self.assertIn(label, [a["headline"] for a in SRI_LANKA])

    def test_labels_are_concise(self):
        long = article("Word " * 60)
        label = cluster_articles([long])[0]["label"]
        self.assertLessEqual(len(label), 100)
        self.assertTrue(label.endswith("…"))

    def test_shorten_cuts_on_a_word_boundary(self):
        self.assertEqual(shorten("Trump addresses the General Assembly in New York", limit=30), "Trump addresses the General…")
        self.assertEqual(shorten("Short headline"), "Short headline")

    def test_duplicate_labels_are_made_distinct(self):
        data = [
            article("Live updates", "Wildfire spreads across Chile forests near Valparaiso"),
            article("Live updates", "Central bank raises interest rates to fight inflation"),
        ]
        labels = [c["label"] for c in cluster_articles(data, threshold=0.5)]
        self.assertEqual(len(labels), 2)
        self.assertEqual(len(set(labels)), 2)
        self.assertTrue(all(label.startswith("Live updates") for label in labels))


if __name__ == "__main__":
    unittest.main()
