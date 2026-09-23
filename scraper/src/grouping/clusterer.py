"""
Topic grouping with TF-IDF + cosine similarity.

1. Each article becomes one document: headline + summary + the lead of its body.
2. TF-IDF turns documents into vectors; cosine similarity compares them.
3. Average-linkage agglomerative clustering: start with every article alone,
   repeatedly merge the two most similar groups, and stop when the best
   remaining pair's AVERAGE similarity is below the threshold.

Why average linkage instead of "link anything above the threshold"
(connected components): if A~B and B~C but A and C are unrelated, connected
components chains them into one group, and on real news it produced a
42-article blob. Average linkage merges B's group with C only if C is similar
to the group as a whole. The result does not depend on input order.
"""
import logging
import re

import numpy as np
from scipy.cluster.hierarchy import fcluster, linkage
from scipy.spatial.distance import squareform
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from src.config import MAX_CLUSTER_TEXT_LENGTH, SIMILARITY_THRESHOLD
from src.utils.text import WHITESPACE, clean_html, strip_boilerplate

logger = logging.getLogger(__name__)

MAX_LABEL_LENGTH = 100
URL_PATTERN = re.compile(r"https?://\S+|www\.\S+")
NON_ALPHANUMERIC = re.compile(r"[^a-z0-9\s]")


def normalize_for_tfidf(text):
    text = URL_PATTERN.sub(" ", text.lower())
    text = NON_ALPHANUMERIC.sub(" ", text)
    return WHITESPACE.sub(" ", text).strip()


def prepare_document(article, max_body_chars=MAX_CLUSTER_TEXT_LENGTH):
    """headline + summary + first max_body_chars of the body, cleaned for TF-IDF."""
    # Bodies are stored as plain text; boilerplate is matched line by line, so it
    # is removed before any whitespace is collapsed.
    body = strip_boilerplate(article.get("body") or "")[:max_body_chars]
    parts = [article.get("headline") or "", clean_html(article.get("summary") or ""), body]
    return normalize_for_tfidf(" ".join(parts))


def _group_labels(similarity, threshold):
    """Average-linkage cluster id for each row of a cosine similarity matrix."""
    distance = np.clip(1.0 - similarity, 0.0, None)
    np.fill_diagonal(distance, 0.0)
    tree = linkage(squareform(distance, checks=False), method="average")
    return fcluster(tree, t=1.0 - threshold, criterion="distance")


def shorten(text, limit=MAX_LABEL_LENGTH):
    text = WHITESPACE.sub(" ", text).strip()
    if len(text) <= limit:
        return text
    cut = text[: limit - 1].rsplit(" ", 1)[0].rstrip(" ,;:-–—")
    return f"{cut}…"


def representative_headline(member_rows, vectorizer, tfidf, headlines):
    """
    Picks the member headline closest to the cluster's centre (the mean TF-IDF
    vector). Labels are therefore always real headlines, built only from words
    the articles contain, and they read naturally, unlike a keyword list.
    Ties go to the earliest member.
    """
    if len(member_rows) == 1:
        return headlines[0]
    centroid = np.asarray(tfidf[member_rows].mean(axis=0))
    headline_vectors = vectorizer.transform([normalize_for_tfidf(h) for h in headlines])
    scores = cosine_similarity(headline_vectors, centroid).ravel()
    return headlines[int(np.argmax(scores))]


def _deduplicate_labels(clusters, vectorizer, tfidf):
    """If two clusters would share a label, add each one's top distinguishing term."""
    seen = {}
    terms = vectorizer.get_feature_names_out() if vectorizer is not None else []
    for cluster in clusters:
        label = cluster["label"]
        if label not in seen:
            seen[label] = 1
            continue
        seen[label] += 1
        suffix = str(seen[label])
        rows = cluster.get("_rows")
        if rows and len(terms):
            centroid = np.asarray(tfidf[rows].mean(axis=0)).ravel()
            for term_index in np.argsort(centroid)[::-1][:5]:
                term = terms[term_index]
                if term not in label.lower():
                    suffix = term
                    break
        cluster["label"] = shorten(f"{label} ({suffix})")


def cluster_articles(articles, threshold=SIMILARITY_THRESHOLD, max_body_chars=MAX_CLUSTER_TEXT_LENGTH):
    """
    Groups articles into topic clusters. Returns a list of
    {"label", "articleCount", "article_indices"}. Every article appears in
    exactly one cluster. Output order is deterministic: by earliest article
    index in each cluster.
    """
    if not articles:
        return []

    documents = [prepare_document(a, max_body_chars) for a in articles]
    usable = [i for i, doc in enumerate(documents) if doc]
    headlines = [shorten(a.get("headline") or "Untitled") for a in articles]

    groups = {}          # group key -> list of article indices
    vectorizer = tfidf = None
    row_of = {}          # article index -> row in the TF-IDF matrix

    if len(usable) >= 2:
        vectorizer = TfidfVectorizer(stop_words="english", sublinear_tf=True)
        try:
            tfidf = vectorizer.fit_transform([documents[i] for i in usable])
        except ValueError:
            # Every usable document was only stop words.
            vectorizer = tfidf = None

    if tfidf is not None:
        row_of = {article_index: row for row, article_index in enumerate(usable)}
        labels = _group_labels(cosine_similarity(tfidf), threshold)
        for article_index, group in zip(usable, labels):
            groups.setdefault(("group", int(group)), []).append(article_index)
        leftovers = [i for i in range(len(articles)) if i not in row_of]
    else:
        leftovers = list(range(len(articles)))

    # Articles with no usable text are never merged: they stay on their own.
    for i in leftovers:
        groups[("single", i)] = [i]

    clusters = []
    for members in sorted(groups.values(), key=min):
        members = sorted(members)
        rows = [row_of[i] for i in members if i in row_of]
        if len(rows) == len(members) and len(members) > 1:
            label = representative_headline(rows, vectorizer, tfidf, [headlines[i] for i in members])
        else:
            label = headlines[members[0]]
        clusters.append({"label": label, "articleCount": len(members), "article_indices": members, "_rows": rows})

    _deduplicate_labels(clusters, vectorizer, tfidf)
    for cluster in clusters:
        del cluster["_rows"]

    multi = sum(1 for c in clusters if c["articleCount"] > 1)
    largest = max(c["articleCount"] for c in clusters)
    logger.info(
        f"[CLUSTER] Formed {len(clusters)} clusters from {len(articles)} articles "
        f"({multi} multi-article, largest {largest}, threshold {threshold})"
    )
    return clusters
