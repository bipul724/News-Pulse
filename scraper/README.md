# News Pulse Scraper

The Python ingestion pipeline for News Pulse. It reads public RSS feeds, stores new articles in the shared Supabase PostgreSQL database, and groups related articles into topic clusters with TF-IDF and cosine similarity.

The Node backend runs it as a subprocess (`POST /ingest/trigger`). You can also run it by hand.

## Pipeline

```text
RSS feeds ──► normalize ──► skip known URLs ──► extract new pages ──► insert ──► cluster all ──► replace clusters
 (3 feeds)    title/URL/     (one query)         (bounded threads,    (one       (only if       (one transaction)
              date/summary                        per-site probe)      statement)  data changed)
```

| Step | Module |
| --- | --- |
| Fetch and parse feeds | `src/rss/fetcher.py` |
| URL, date and text normalization | `src/utils/urls.py`, `src/utils/dates.py`, `src/utils/text.py` |
| Full-text extraction | `src/extraction/article_extractor.py` |
| TF-IDF clustering and labels | `src/grouping/clusterer.py` |
| Database access | `src/storage/postgres.py` |
| Orchestration, summary, exit code | `src/main.py` |

## RSS sources

| Source name (as stored) | Feed |
| --- | --- |
| BBC News | `http://feeds.bbci.co.uk/news/world/rss.xml` |
| NPR Topics: World | `https://feeds.npr.org/1004/rss.xml` |
| NYT > World News | `https://rss.nytimes.com/services/xml/rss/nyt/World.xml` |

- **Source name.** The feed's own title (whitespace trimmed), or the feed's hostname if the title is missing. It is deliberately not renamed: existing rows are grouped and filtered by this exact value.
- **Downloads.** Feeds are fetched with `requests` using a 15s timeout, then parsed by `feedparser`. `feedparser.parse(url)` itself has no timeout, so one hanging feed could stall the whole run.
- **Failure isolation.** A failed or malformed feed is logged and the other feeds continue. A malformed item is skipped and the rest of its feed is kept.
- **Unusable items.** Items without a title or without an http(s) link are skipped and counted.
- **Duplicates across feeds.** The same article appearing in two feeds is kept once.

## Normalization

**Dates** (`parse_date`):
- feedparser's pre-parsed UTC fields are used first; otherwise RFC 822 and ISO 8601 strings are parsed with `dateutil`
- timezone offsets are converted to UTC, and naive timestamps are assumed to be UTC
- a date more than 24h in the future or before 1990 is rejected, and a slightly future one (clock skew) is clamped to now
- if an item has no usable date, the fetch time is used and the fallback is logged. The item is in the live feed at that moment, so the fetch time is a close approximation; dropping real news would be worse.
- the database session is set to UTC, so values stored in the `timestamp` columns are always UTC

**URLs** (`normalize_url`), applied before any duplicate check:
- trim whitespace, lowercase the scheme and host, drop the default port and the `#fragment`
- remove a trailing slash (except on `/`)
- remove known tracking parameters only: `utm_*`, BBC's `at_medium` / `at_campaign`, `smid`, `fbclid`, `gclid`, `cmpid`. Every other parameter is kept and sorted.
- http is not rewritten to https

**Summaries** (`<description>` vs `<content:encoded>`):
- `<description>` is used when present.
- If it's missing, the cleaned `<content:encoded>` is used instead, cut to 500 characters.
- Feeds use `<content:encoded>` differently. NPR puts a longer HTML intro there; NYT usually puts a photo caption. Either is real publisher text, which beats having no summary.
- Stored articles that have no summary get one filled in on a later run, with one `UPDATE` that only touches empty summaries. That triggers a cluster rebuild, because their clustering text changed.
- Items with neither field (e.g. NYT "Here's the latest." live blogs) keep an empty summary.

**Text.** Summaries have HTML stripped (with no stray space before punctuation). BBC's "Related topics" block is removed as boilerplate (see Clustering for why).

## Duplicate strategy and re-runs

1. Fetch all feeds and normalize every URL.
2. Load the stored URLs (one query) and normalize them too. Rows stored before normalization existed (for example BBC links with `?at_medium=RSS`) therefore still match.
3. Drop known articles **before** downloading any page, so re-runs cost no extraction requests.
4. Insert the new articles in one statement with `ON CONFLICT (url) DO NOTHING`. The database's `UNIQUE(url)` stays the final guard.
5. Rebuild clusters only if something changed:
   - new rows were inserted, or
   - a stored article gained a summary, or
   - some article has no cluster, or
   - no clusters exist yet.

   Otherwise clustering is skipped: the input is the same and the algorithm is deterministic, so the result would be identical.

After changing `SIMILARITY_THRESHOLD`, use `--force-recluster` to rebuild immediately.

## Extraction and HTTP 403

Only new articles are downloaded, using a thread pool of `EXTRACTION_CONCURRENCY` workers (default 5) with an `ARTICLE_TIMEOUT_SECONDS` timeout.

Work runs in two waves:
1. **Probe:** one article per site, in parallel.
2. **Rest:** all remaining articles, in parallel. A site that answered the probe with 401/403/429/451 is skipped for the rest of **this run only**, so its remaining articles cost no requests. The next run tries again; nothing is blacklisted permanently.

Without the probe wave, all parallel requests to a blocking site were already in flight before the first 403 came back. This happened in testing: 4 NYT requests went out, 4 were refused.

Each article gets exactly one outcome:

| Outcome | Meaning | `body` stored |
| --- | --- | --- |
| extracted | article text found (at least 200 characters) | the text |
| blocked | the site refused this request (401/403/429/451) | NULL |
| skipped | not requested: the site refused earlier in this run | NULL |
| failed | timeout, network error, 404/5xx, non-HTML response | NULL |
| empty | the page loaded but had no article text (e.g. video pages, teasers) | NULL |

Text comes from `trafilatura`, falling back to the paragraphs inside `<article>`. A page's `<p>` tags outside `<article>` are ignored, because they are mostly navigation.

**NYT limitation.** nytimes.com answers automated requests with HTTP 403. This pipeline respects that: NYT articles are stored with their RSS headline and summary, and `body` is NULL. They are clustered on headline + summary and are never counted as successfully extracted. Nothing here tries to get around access controls.

## Clustering

**Documents.** Each article becomes one document:
- headline + summary + the first `MAX_CLUSTER_TEXT_LENGTH` (default 1000) characters of the body, with BBC boilerplate removed
- lowercased, with URLs and punctuation removed

**Vectors.** `TfidfVectorizer(stop_words="english", sublinear_tf=True)`, compared with cosine similarity.

**Grouping.** Average-linkage agglomerative clustering (`scipy`):
1. Every article starts alone.
2. The two most similar groups are merged, where "similar" is the average similarity across all their article pairs.
3. Merging stops when no pair of groups reaches `SIMILARITY_THRESHOLD`.

This makes chains explicit. If A~B and B~C but A and C are unrelated, C joins {A, B} only when it is similar to the group on average. The previous version compared each article only with a "seed" article and depended on database row order. Over 20 row orders of the same 103 articles it produced 20 different results (34–42 clusters). The new result is the same for any input order, and rows are also read in a fixed order (`publishedAt`, `id`).

**Articles with no usable text** stay in their own cluster; they are never merged. Every article is in exactly one cluster; the storage layer checks this before writing.

### Choosing the threshold (0.12)

The threshold was chosen from measurements, not guessed. I hand-labelled 103 real stored articles:
- 10 real events covered by several articles (for example the Sri Lanka Easter-bombing verdict: NPR + NYT + BBC)
- 6 pairs that look alike but are different stories (for example two separate South Africa crime stories)

That gives 32 must-group pairs and 380 must-separate pairs. I scored each configuration on pairwise precision (merged pairs that are correct) and recall (same-event pairs that were merged):

| Configuration | Precision | Recall | Clusters |
| --- | --- | --- | --- |
| Previous: seed-based, 0.15, full body (range over 20 row orders) | 0.27–0.79 | 0.50–0.94 | 34–42 |
| Average linkage, 0.15, full body up to 5000 chars | 0.91 | 0.62 | 66 |
| + boilerplate removed | 0.96 | 0.72 | 66 |
| + body limited to 1000 chars, 0.15 | 0.96 | 0.75 | 68 |
| **+ threshold 0.12 (chosen)** | **0.97** | **1.00** | **61** |
| same, threshold 0.10 | 0.97 | 1.00 | 59 |

Findings:
- **Long bodies hurt.** Beyond the lead, bodies add many incidental words and dilute the shared key terms. That is why `MAX_CLUSTER_TEXT_LENGTH` defaults to 1000, not 5000.
- **BBC boilerplate made unrelated BBC stories look similar.** Every BBC page ends with *"Updates from your News topics will appear in My News…"*.
- **0.10 scored the same as 0.12.** 0.12 was chosen as the more conservative of the two, because the labelled set is small and comes from one day of news.

### Labels

A cluster's label is the member headline closest to the cluster's centre (the mean TF-IDF vector). Labels are therefore always real headlines, built only from words in the articles, and they read naturally, unlike keyword lists such as "trump, assembly, general".

- Labels are cut at 100 characters on a word boundary.
- If two clusters would get the same label, the later one gets its most distinctive term appended, for example "Live updates (wildfire)".

## Database writes and transactions

- **Connection.** Opened once per run as a context manager and closed on exit. The session is set to UTC. Reads run in autocommit; every write is an explicit transaction that commits on success and rolls back on any error.
- **Insert.** A single `INSERT … SELECT FROM unnest(...) ON CONFLICT (url) DO NOTHING RETURNING url`. It is one round trip, and the inserted count is exact. (The previous version made one round trip and one commit per article.)
- **Cluster rebuild.** One transaction:
  ```text
  BEGIN
    advisory lock (serializes overlapping runs)
    UPDATE "Article" SET "clusterId" = NULL
    DELETE FROM "Cluster"
    INSERT all clusters            (one statement)
    UPDATE all Article.clusterId   (one statement)
    check: rows updated == articles assigned, else raise
  COMMIT                           (any error: ROLLBACK, old clusters stay)
  ```
  Article rows are never deleted. Because every article is unlinked and relinked inside the same transaction, no article can be left pointing at a deleted cluster.

## Failure policy

| Handled, counted, run continues | Fails the run (exit code 1, backend marks the job failed) |
| --- | --- |
| malformed RSS item, missing title/URL | database unreachable or `DATABASE_URL` missing |
| unparseable or unreasonable date | a failed insert or cluster transaction |
| one feed down or malformed | every feed failing |
| HTTP 403 / 404 / timeouts / non-HTML pages | invalid configuration values |
| HTML that trafilatura cannot parse | |

## Logs

Log lines are grouped by category: `[RSS]`, `[EXTRACT]`, `[CLUSTER]`, `[DB]`, `[PIPELINE]`. Every run ends with a summary built only from counted values:

```text
[PIPELINE] INGESTION SUMMARY
[PIPELINE] Feeds processed:        3/3
[PIPELINE] RSS articles fetched:   95
[PIPELINE] Already known:          91
[PIPELINE] New articles:           4 found, 4 inserted
[PIPELINE] Extraction success:     0
[PIPELINE] Extraction unavailable: 4 (blocked 4, skipped 0, failed 0, empty 0)
[PIPELINE] Clusters:               63 rebuilt (4 new articles)
[PIPELINE] Duration:               5.0s
```

The backend reads these lines to fill the job metrics, so their wording must not change: "Fetched N total articles from RSS feeds", "Found N new articles to process", "Inserted N new articles" and "Formed N clusters".

## Setup

```bash
cd scraper
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set DATABASE_URL to the backend's database
```

## Running

```bash
python3 -m src.main                    # one ingestion
python3 -m src.main --force-recluster  # also rebuild clusters when nothing is new
```

Always run as a module from the `scraper` directory; the backend does the same (`$PYTHON_COMMAND -m src.main` with `cwd = SCRAPER_PATH`).

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | — (required) | Supabase PostgreSQL connection string |
| `RSS_FEEDS` | the 3 feeds above | Comma-separated feed URLs |
| `SIMILARITY_THRESHOLD` | `0.12` | Minimum average cosine similarity for groups to merge |
| `ARTICLE_TIMEOUT_SECONDS` | `10` | Timeout per article page request |
| `EXTRACTION_CONCURRENCY` | `5` | Maximum parallel page downloads |
| `MAX_CLUSTER_TEXT_LENGTH` | `1000` | Body characters used for clustering |

Invalid values stop the run with a clear error.

## Tests

```bash
python3 -m unittest discover -s tests -v    # offline: no network, no database
RUN_INTEGRATION_TESTS=true python3 -m unittest tests.test_integration -v
```

The integration tests are opt-in and read-only. They fetch the live feeds and check the database for articles pointing at missing clusters.

## Known limitations

- **NYT full text is unavailable** (HTTP 403). NYT topics are clustered on headline + summary only.
- **Every run re-clusters all stored articles** whenever something is new. That is fine at hundreds of articles. At much larger scale, the pairwise similarity matrix grows quadratically, and clustering should be limited to a recent window (for example the last 7 days).
- **Legacy URLs.** Rows stored before URL normalization keep their original URL (BBC links still carry `?at_medium=RSS`). Duplicate checks normalize both sides, so they are not re-inserted. For those rows, though, the database's UNIQUE constraint does not protect the normalized form; only the Python check does.
- **Small labelled set.** The threshold was tuned on one day of news (103 articles). It should be re-checked as sources or topics change.
- **Metrics depend on log wording.** The backend's job metrics come from log lines; `clustersCreated` is `null` when a run skips clustering.
