# News Pulse Backend

The Node.js backend for the News Pulse application.

## Architecture

This backend serves as an orchestration layer and API server. It does the following:
1. Connects to Supabase PostgreSQL using Prisma ORM to read and serve normalized article and cluster data.
2. Exposes a clean, RESTful API tailored for Next.js timeline and cluster-detail visualization.
3. Coordinates the Python pipeline execution for article ingestion and clustering.
4. Uses an asynchronous pattern for triggering the Python scraper to ensure the API remains responsive.

It uses Node.js, Express, and Prisma as the core technologies.

## Setup Steps

1. Make sure Node.js (v20+) is installed.
2. Inside the `/backend` directory, install dependencies:
   ```bash
   npm install
   ```
3. Set up the environment variables:
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` to reflect your Supabase PostgreSQL connection string (`DATABASE_URL`).*
4. Apply the database migrations (creates `Article`, `Cluster` and `IngestionJob`):
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```
5. Ensure the Python scraper is available and configure `SCRAPER_PATH` in `.env` if necessary.

## Environment Variables

- `PORT` (default: 5000) - The port the server runs on.
- `DATABASE_URL` - The Supabase PostgreSQL connection string. Must use the direct connection URL for Prisma migrations.
- `FRONTEND_URL` - Used to configure CORS allowing requests from the frontend.
- `PYTHON_COMMAND` - The python executable (e.g., `python` or `python3`).
- `SCRAPER_PATH` - The path to the Python scraper directory, relative to `backend`.

## Database Setup

The backend expects a Supabase PostgreSQL connection string in `DATABASE_URL`. Migrations live in `prisma/migrations`; apply them with `npx prisma migrate deploy`.

Tables:

| Table | Written by | Purpose |
| --- | --- | --- |
| `Article` | Python scraper | One row per unique article URL |
| `Cluster` | Python scraper | Topic clusters, rebuilt on every ingestion |
| `IngestionJob` | Node.js | Status and metrics of each ingestion run |

## Data Flow

Two paths reach the same Supabase database:

```text
Reads:      Node.js (Express) → Prisma (@prisma/adapter-pg) → Supabase PostgreSQL
Ingestion:  Node.js → Python subprocess (child_process.spawn) → Supabase PostgreSQL (psycopg)
```

Node never writes articles or clusters itself; it only serves them and records ingestion jobs.

## Ingestion Jobs

Every ingestion run is an `IngestionJob` row in PostgreSQL, so job status survives server restarts.

```text
queued ──► running ──► completed
                  └──► failed
```

1. `POST /ingest/trigger` checks for a job that is `queued` or `running`. If one exists it returns `409`.
2. Otherwise it inserts a job with `status = "queued"` and responds `202` immediately with the `jobId`.
3. In the background the job is set to `running` (with `startedAt`), and the scraper starts with `child_process.spawn`.
4. When Python exits, the job is set to `completed` (exit code 0) or `failed` (any other exit code or a spawn error), with `completedAt`.
   A failed job stores the last 500 characters of the scraper output in `error`. Connection strings in that output are redacted first.

**Metrics.** The scraper already logs its counts. Node reads them from the process output and stores them on the job:

| Field | Scraper log line | Meaning |
| --- | --- | --- |
| `fetchedArticles` | `Fetched N total articles from RSS feeds` | Items read from all feeds, including already-known ones |
| `newArticles` | `Inserted N new articles` (or `Found 0 new articles`) | Rows actually inserted into `Article` |
| `clustersCreated` | `Formed N clusters` | Clusters after the rebuild (all clusters are recreated every run) |

A metric stays `null` if the run ended before logging it.

**Restarts.** A job still `queued` or `running` when the server starts can never finish, because its Python process belonged to the previous server. On startup those jobs are marked `failed`, so they do not block new runs with `409`.

## How to Start

- **Development:** `npm run dev` (uses nodemon)
- **Production:** `npm start`
- **Testing:** `npm test`

## API Endpoints

### `GET /health`
Returns service status. Does not touch the database.

### `GET /health/db`
Runs `SELECT 1` through Prisma.

- `200 {"status":"ok","database":"connected"}`
- `503 {"status":"error","database":"unavailable"}` when the database cannot be reached. The cause is logged on the server, never returned.

### `GET /sources`
Sources that actually appear in `Article`, with counts, sorted by `articleCount` descending (one `GROUP BY` query). Returns `{"sources": []}` when there are no articles.

```json
{ "sources": [{ "name": "NYT > World News", "articleCount": 62 }, { "name": "BBC News", "articleCount": 29 }] }
```

### `GET /stats`
```json
{ "articles": 102, "clusters": 40, "sources": 3, "lastIngestion": "2026-09-23T08:50:12.206Z" }
```
`lastIngestion` is the `completedAt` of the most recent `completed` job, or `null` if none has completed.

### `GET /clusters`
Returns a list of all topic clusters.

### `GET /clusters/:id`
Returns detailed cluster information along with its related articles.

### `GET /timeline`
Returns chart-friendly timeline data for visualization.

### `POST /ingest/trigger`
Starts an ingestion run in the background.

- `202 {"jobId": "...", "status": "queued"}`
- `409` with `error.code = "CONCURRENT_INGESTION_CONFLICT"` and `error.jobId` when a job is already queued or running.

### `GET /ingest/status/:jobId`
Reads the job from PostgreSQL.

```json
{
  "jobId": "a2c52457-55a0-47eb-9dca-02eb5b001aac",
  "status": "completed",
  "startedAt": "2026-09-23T08:49:23.382Z",
  "completedAt": "2026-09-23T08:50:12.206Z",
  "stats": { "fetchedArticles": 95, "newArticles": 2, "clustersCreated": 40 },
  "error": null
}
```

Returns `400` for a malformed job ID and `404` for an unknown job.

## Assumptions & Limitations

- For this assessment, authentication and authorization are skipped.
- Only one ingestion job can run at a time; another trigger returns `409 Conflict`. The check and the insert are two separate queries, so two triggers arriving within milliseconds of each other could both start a job. That is acceptable for a manual Refresh button, and would need a database-level lock if triggers became automated.
- Ingestion metrics depend on the scraper's log wording. If those log lines change, the metrics become `null`; the job status is not affected.
- A standard local python binary/environment is assumed for triggering the pipeline.
