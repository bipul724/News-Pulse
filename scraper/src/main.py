"""
News Pulse ingestion pipeline. Run from the scraper directory:

    python3 -m src.main [--force-recluster]

Failure policy:
  * Per-item problems (bad RSS item, bad date, extraction failure, HTTP 403/404,
    unparseable HTML) are handled where they happen, counted, and the run continues.
  * Infrastructure problems (database unreachable, every feed failing, a failed
    transaction) stop the run with exit code 1, so the backend marks the job failed.

The log lines "Fetched N total articles from RSS feeds", "Found N new articles to
process", "Inserted N new articles" and "Formed N clusters" are parsed by the
Node backend for job metrics; keep their wording.
"""
import argparse
import logging
import sys
import time
from dataclasses import dataclass, field

from src.config import (
    ARTICLE_TIMEOUT_SECONDS,
    EXTRACTION_CONCURRENCY,
    MAX_CLUSTER_TEXT_LENGTH,
    RSS_FEEDS,
    SIMILARITY_THRESHOLD,
)
from src.extraction.article_extractor import BLOCKED, EMPTY, EXTRACTED, FAILED, SKIPPED, extract_all
from src.grouping.clusterer import cluster_articles
from src.rss.fetcher import fetch_feeds
from src.storage.postgres import PostgresStorage

logger = logging.getLogger("src.main")


class PipelineError(RuntimeError):
    """A failure that should fail the whole run."""


@dataclass
class RunStats:
    feeds_total: int = 0
    feeds_ok: int = 0
    fetched: int = 0
    already_known: int = 0
    summaries_filled: int = 0
    new_candidates: int = 0
    inserted: int = 0
    extraction: dict = field(default_factory=dict)
    clusters: int = None          # None when clustering was skipped
    recluster_reason: str = ""
    duration: float = 0.0


def run_pipeline(storage, feed_urls, force_recluster=False):
    started = time.monotonic()
    stats = RunStats(feeds_total=len(feed_urls))

    # 1. RSS
    articles, feed_results = fetch_feeds(feed_urls)
    stats.feeds_ok = sum(1 for r in feed_results if r.ok)
    stats.fetched = len(articles)
    logger.info(
        f"[RSS] Fetched {stats.fetched} total articles from RSS feeds "
        f"({stats.feeds_ok}/{stats.feeds_total} feeds OK)"
    )
    if stats.feeds_total and stats.feeds_ok == 0:
        raise PipelineError("every RSS feed failed; check network access")

    # 2. Duplicate check on normalized URLs, before any page is downloaded
    existing_urls = storage.get_existing_urls()
    new_articles = [a for a in articles if a["url"] not in existing_urls]
    stats.already_known = stats.fetched - len(new_articles)
    known_articles = [a for a in articles if a["url"] in existing_urls]
    stats.summaries_filled = storage.fill_missing_summaries(known_articles)
    stats.new_candidates = len(new_articles)
    logger.info(f"[PIPELINE] Found {stats.new_candidates} new articles to process ({stats.already_known} already known)")

    # 3. Extraction (new articles only) and 4. insert
    if new_articles:
        outcomes = extract_all(new_articles, EXTRACTION_CONCURRENCY, ARTICLE_TIMEOUT_SECONDS)
        stats.extraction = dict(outcomes)
        logger.info(
            f"[EXTRACT] full text for {outcomes[EXTRACTED]}/{len(new_articles)} articles "
            f"(blocked {outcomes[BLOCKED]}, skipped after block {outcomes[SKIPPED]}, "
            f"failed {outcomes[FAILED]}, no article text {outcomes[EMPTY]}); the rest use RSS title + summary"
        )
        stats.inserted = storage.insert_articles(new_articles)

    # 5. Clustering: only when the stored data changed or is incomplete
    if force_recluster:
        stats.recluster_reason = "forced with --force-recluster"
    elif stats.inserted:
        stats.recluster_reason = f"{stats.inserted} new articles"
    elif stats.summaries_filled:
        stats.recluster_reason = f"{stats.summaries_filled} articles gained a summary"
    elif storage.needs_recluster():
        stats.recluster_reason = "unclustered articles found"

    if stats.recluster_reason:
        stored = storage.get_articles_for_clustering(MAX_CLUSTER_TEXT_LENGTH)
        if stored:
            clusters = cluster_articles(stored, threshold=SIMILARITY_THRESHOLD, max_body_chars=MAX_CLUSTER_TEXT_LENGTH)
            storage.replace_clusters(clusters, stored)
            stats.clusters = len(clusters)
        else:
            logger.info("[CLUSTER] No articles stored yet; nothing to cluster.")
    else:
        logger.info("[CLUSTER] Skipped: no new articles and every article already has a cluster.")

    stats.duration = time.monotonic() - started
    return stats


def log_summary(stats):
    ex = stats.extraction
    unavailable = sum(ex.get(k, 0) for k in (BLOCKED, SKIPPED, FAILED, EMPTY))
    lines = [
        "=" * 50,
        "INGESTION SUMMARY",
        "=" * 50,
        f"Feeds processed:        {stats.feeds_ok}/{stats.feeds_total}",
        f"RSS articles fetched:   {stats.fetched}",
        f"Already known:          {stats.already_known}"
        + (f" ({stats.summaries_filled} given a missing summary)" if stats.summaries_filled else ""),
        f"New articles:           {stats.new_candidates} found, {stats.inserted} inserted",
        f"Extraction success:     {ex.get(EXTRACTED, 0)}",
        f"Extraction unavailable: {unavailable}"
        + (f" (blocked {ex.get(BLOCKED, 0)}, skipped {ex.get(SKIPPED, 0)}, failed {ex.get(FAILED, 0)}, empty {ex.get(EMPTY, 0)})" if unavailable else ""),
        f"Clusters:               "
        + (f"{stats.clusters} rebuilt ({stats.recluster_reason})" if stats.clusters is not None else "unchanged (skipped)"),
        f"Duration:               {stats.duration:.1f}s",
        "=" * 50,
    ]
    for line in lines:
        logger.info(f"[PIPELINE] {line}")


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python3 -m src.main", description="Run one News Pulse ingestion.")
    parser.add_argument(
        "--force-recluster",
        action="store_true",
        help="rebuild clusters even when no new articles arrived (e.g. after changing SIMILARITY_THRESHOLD)",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    # Library chatter (trafilatura download errors, urllib3 retries) would hide our own log lines.
    for noisy in ("trafilatura", "urllib3", "charset_normalizer"):
        logging.getLogger(noisy).setLevel(logging.CRITICAL)

    logger.info("[PIPELINE] Starting ingestion pipeline...")
    try:
        with PostgresStorage() as storage:
            stats = run_pipeline(storage, RSS_FEEDS, force_recluster=args.force_recluster)
    except Exception as e:
        logger.error(f"[PIPELINE] Ingestion pipeline failed: {e}", exc_info=True)
        return 1

    log_summary(stats)
    logger.info("[PIPELINE] Ingestion pipeline completed successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
