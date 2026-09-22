import logging
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from src.config import SIMILARITY_THRESHOLD
import re

logger = logging.getLogger(__name__)

def clean_text_for_clustering(text):
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r'[^\w\s]', '', text)
    return text

def cluster_articles(articles):
    """
    Takes a list of article dictionaries and groups them into clusters based on TF-IDF + Cosine Similarity.
    Returns a list of cluster dictionaries.
    """
    if not articles:
        return []

    logger.info(f"Clustering {len(articles)} articles...")

    # Build corpus
    corpus = []
    for a in articles:
        # Combine headline, summary, and body
        combined = f"{a.get('headline', '')} {a.get('summary', '')} {a.get('body', '')}"
        corpus.append(clean_text_for_clustering(combined))

    vectorizer = TfidfVectorizer(stop_words='english', max_features=1000)
    
    try:
        tfidf_matrix = vectorizer.fit_transform(corpus)
    except ValueError:
        # If corpus is empty or only stopwords
        logger.warning("TF-IDF vectorizer failed (empty corpus or only stopwords).")
        return []

    cosine_sim = cosine_similarity(tfidf_matrix)

    clusters = []
    visited = set()

    feature_names = vectorizer.get_feature_names_out()

    for i in range(len(articles)):
        if i in visited:
            continue
            
        cluster_articles_indices = [i]
        visited.add(i)
        
        for j in range(i + 1, len(articles)):
            if j not in visited and cosine_sim[i][j] >= SIMILARITY_THRESHOLD:
                cluster_articles_indices.append(j)
                visited.add(j)
                
        # Determine cluster label using the top TF-IDF term from the first article in cluster
        # or fallback to the headline of the first article
        first_article = articles[i]
        label = first_article.get('headline', 'Unknown Topic')
        
        # Calculate start and end times
        times = [articles[idx].get('publishedAt') for idx in cluster_articles_indices if articles[idx].get('publishedAt')]
        start_time = min(times) if times else None
        end_time = max(times) if times else None

        cluster = {
            'label': label,
            'articleCount': len(cluster_articles_indices),
            'startTime': start_time,
            'endTime': end_time,
            'article_indices': cluster_articles_indices
        }
        clusters.append(cluster)
        
    logger.info(f"Formed {len(clusters)} clusters.")
    return clusters
