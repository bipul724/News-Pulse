# News Pulse Scraper

This is the Python ingestion pipeline for News Pulse. It periodically fetches news articles from public RSS feeds, extracts their full content, and clusters related stories together using TF-IDF.

## Architecture

1. **RSS Ingestion**: Pulls feeds using `feedparser`.
2. **Article Extraction**: Scrapes the full article text using `trafilatura` with a `BeautifulSoup` fallback. Network timeouts are gracefully handled so they don't break the whole pipeline.
3. **Duplicate Prevention**: Before processing, the script fetches existing article `url`s from Supabase PostgreSQL. Already known articles are skipped.
4. **Topic Grouping**: Combines `headline + summary + body`, calculates TF-IDF vectors, and groups them based on cosine similarity exceeding `SIMILARITY_THRESHOLD`.
5. **Storage**: Connects to the same Supabase PostgreSQL instance as the Node backend via psycopg2. Re-creates clusters on each run to ensure new articles correctly group with existing ones.

## Requirements

- Python 3.9+
- PostgreSQL (Supabase)

## Setup

1. Create a virtual environment and install dependencies:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Ensure `DATABASE_URL` matches the backend database.

## Running

The scraper is typically triggered by the Node.js backend. However, you can run it manually:

```bash
python3 src/main.py
```

## Known Limitations

- **Re-clustering Overhead**: Currently, every ingestion run fetches *all* articles from the database to re-cluster them with the new articles. While this ensures perfect groupings over time without duplicate articles, it will scale poorly as the database grows to hundreds of thousands of articles. A production system would limit the clustering window (e.g., only clustering articles from the last 7 days).
