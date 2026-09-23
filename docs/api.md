# News Pulse REST API

The Node.js backend (`/backend`) serves everything the web app shows and controls ingestion runs. All responses are JSON. The examples below are real responses from a local instance, trimmed to one item where a list was long.

- **Base URL (live):** `https://news-pulse-api-tgxl.onrender.com` (Render free tier; the first request after idling can take about a minute)
- **Base URL (local):** `http://localhost:5001`, the `PORT` value in `backend/.env`
- **CORS:** only the origin(s) listed in `FRONTEND_URL` are allowed, comma-separated (default `http://localhost:3000`)
- **Authentication:** none (see [Security notes](#security-notes))
- **Times:** ISO 8601 in UTC, e.g. `2026-09-23T09:02:59.000Z`
- **IDs:** UUID v4 strings

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | [`/health`](#get-health) | Is the API process up? |
| GET | [`/health/db`](#get-healthdb) | Can the API reach the database? |
| GET | [`/timeline`](#get-timeline) | Topics shaped for the timeline chart |
| GET | [`/clusters`](#get-clusters) | Topic list |
| GET | [`/clusters/:id`](#get-clustersid) | One topic with its articles |
| GET | [`/sources`](#get-sources) | News sources present in the data |
| GET | [`/stats`](#get-stats) | Totals and last successful ingestion |
| POST | [`/ingest/trigger`](#post-ingesttrigger) | Start an ingestion run |
| GET | [`/ingest/status/:jobId`](#get-ingeststatusjobid) | Status of an ingestion run |

## Errors

Errors share one shape:

```json
{ "error": { "message": "Cluster not found", "code": "NOT_FOUND" } }
```

| Status | `code` | When |
| --- | --- | --- |
| 400 | `INVALID_ID` | A path ID is not a UUID |
| 404 | `NOT_FOUND` | The cluster or job does not exist |
| 404 | `INTERNAL_SERVER_ERROR` | Unknown route. The status is right; the code is a known quirk of the catch-all handler |
| 409 | `CONCURRENT_INGESTION_CONFLICT` | An ingestion job is already queued or running (includes `jobId`) |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected failure, e.g. the database is unreachable |
| 503 | — | Only from `/health/db`; body is `{"status":"error","database":"unavailable"}` |

Stack traces are included only when `NODE_ENV=development`. Database credentials and connection strings are never returned.

---

## Health

### `GET /health`

Checks only that the process is running. It never touches the database, so it is safe for frequent liveness probes.

```json
{ "status": "ok", "service": "news-pulse-backend" }
```

### `GET /health/db`

Runs `SELECT 1` through Prisma.

| Status | Body |
| --- | --- |
| 200 | `{ "status": "ok", "database": "connected" }` |
| 503 | `{ "status": "error", "database": "unavailable" }` |

The cause of a failure is logged on the server, never sent to the client.

---

## Topics

A **topic** (stored as a `Cluster`) is a group of articles about the same event.
- `start` and `end` are the publication times of its earliest and latest article.
- `label` is the member headline most representative of the group.

### `GET /timeline`

Every topic, with the fields the timeline chart needs. Sorted by `end`, newest first.

```json
{
  "timeline": [
    {
      "id": "fd207e78-c9a5-4383-abbc-573a53454f9b",
      "label": "Japan’s leader aims to highlight her country’s push for a more pivotal global role.",
      "start": "2026-09-22T18:09:44.000Z",
      "end": "2026-09-23T09:02:59.000Z",
      "articleCount": 3,
      "intensity": 0.5,
      "sources": [
        { "name": "NYT > World News", "count": 3 }
      ]
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `articleCount` | Articles in the topic |
| `intensity` | `articleCount` divided by the largest topic's `articleCount` (0–1]. The web app colours bars by it: above 0.6 is heavy, above 0.3 moderate, otherwise light |
| `sources` | Articles per source within this topic |

### `GET /clusters`

A lighter list of topics, newest activity first.

```json
{
  "clusters": [
    {
      "id": "fd207e78-c9a5-4383-abbc-573a53454f9b",
      "label": "Japan’s leader aims to highlight her country’s push for a more pivotal global role.",
      "articleCount": 3,
      "start": "2026-09-22T18:09:44.000Z",
      "end": "2026-09-23T09:02:59.000Z"
    }
  ]
}
```

### `GET /clusters/:id`

One topic and its articles, oldest first.

```json
{
  "cluster": {
    "id": "03f382fb-1931-43f1-b835-f19f02579eca",
    "label": "China’s Leader Xi Seeks to Extend Truce with Trump During U.S. Summit",
    "articleCount": 2,
    "start": "2026-09-22T13:48:06.000Z",
    "end": "2026-09-23T09:00:09.000Z"
  },
  "articles": [
    {
      "id": "c99fae82-ccf0-4c3c-b898-49a781c5d27e",
      "headline": "China’s Leader Xi Seeks to Extend Truce with Trump During U.S. Summit",
      "summary": "Facing an American president constrained by war and politics, China’s leader may seek to lock in a tactical truce while he shores up a fragile economy at home.",
      "source": "NYT > World News",
      "publishedAt": "2026-09-22T13:48:06.000Z",
      "url": "https://www.nytimes.com/2026/09/21/world/asia/xi-trump-meeting-china-summit.html"
    }
  ]
}
```

`summary` can be `null`. The article body is not returned; `url` links to the original.

| Status | Response |
| --- | --- |
| 400 | `{"error":{"message":"Invalid cluster ID format","code":"INVALID_ID"}}` |
| 404 | `{"error":{"message":"Cluster not found","code":"NOT_FOUND"}}` |

> Topic IDs change every time clusters are rebuilt (after an ingestion that added articles). Links to a topic, like the web app's `?topic=<id>`, work until the next rebuild.

---

## Sources and statistics

### `GET /sources`

Sources that actually appear in stored articles, from one `GROUP BY` query. Sorted by `articleCount` descending, then by name. Returns `{"sources": []}` when there are no articles.

```json
{
  "sources": [
    { "name": "NYT > World News", "articleCount": 66 },
    { "name": "BBC News", "articleCount": 29 },
    { "name": "NPR Topics: World", "articleCount": 12 }
  ]
}
```

Source names are the feeds' own titles, exactly as stored.

### `GET /stats`

```json
{ "articles": 107, "clusters": 63, "sources": 3, "lastIngestion": "2026-09-23T09:16:19.406Z" }
```

| Field | Meaning |
| --- | --- |
| `articles` | Rows in `Article` |
| `clusters` | Rows in `Cluster` |
| `sources` | Distinct `Article.source` values |
| `lastIngestion` | `completedAt` of the most recent **completed** job, or `null` if none has completed. Failed runs do not count |

---

## Ingestion

An ingestion run starts the Python scraper, which fetches the feeds, stores new articles and rebuilds the topics. Each run is an `IngestionJob` row, so its status survives API restarts.

```text
queued ──► running ──► completed
                  └──► failed
```

### `POST /ingest/trigger`

Returns immediately. The scraper runs in the background.

**202 Accepted**

```json
{ "jobId": "a2c52457-55a0-47eb-9dca-02eb5b001aac", "status": "queued" }
```

**409 Conflict:** a job is already queued or running. Poll that job instead.

```json
{
  "error": {
    "message": "An ingestion job is already running",
    "code": "CONCURRENT_INGESTION_CONFLICT",
    "jobId": "a2c52457-55a0-47eb-9dca-02eb5b001aac"
  }
}
```

### `GET /ingest/status/:jobId`

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

| Field | Meaning |
| --- | --- |
| `status` | `queued`, `running`, `completed` or `failed` |
| `startedAt` | When the scraper was launched (`null` while queued) |
| `completedAt` | When it finished (`null` until then) |
| `stats.fetchedArticles` | Items read from all feeds, including already-known ones |
| `stats.newArticles` | Rows actually inserted |
| `stats.clustersCreated` | Topics after the rebuild. `null` when the run skipped clustering because nothing changed |
| `error` | For failed jobs: exit code plus the last 500 characters of scraper output, with connection strings redacted |

Metrics are `null` until the scraper reports them, and stay `null` if a run ends before reporting.

| Status | Response |
| --- | --- |
| 400 | `{"error":{"message":"Invalid job ID format","code":"INVALID_ID"}}` |
| 404 | `{"error":{"message":"Job not found","code":"NOT_FOUND"}}` |

**Restarts.** If the API restarts while a job is `queued` or `running`, that job can never finish, because its Python process belonged to the old server. On startup the API marks such jobs `failed` with the error `Interrupted: the server restarted before this job finished.`

### Client flow

This is what the web app's *Refresh Data* button does:

```js
const res = await fetch(`${API}/ingest/trigger`, { method: 'POST' });
const body = await res.json();
const jobId = res.status === 409 ? body.error.jobId : body.jobId;  // join a run already in progress

let job;
do {
  await new Promise(r => setTimeout(r, 2500));
  job = await (await fetch(`${API}/ingest/status/${jobId}`)).json();
} while (job.status === 'queued' || job.status === 'running');

if (job.status === 'completed') await fetch(`${API}/timeline`);  // redraw with fresh data
```

A typical run takes 5–50 seconds. A re-run with no new articles takes about 5 seconds, most of it Python startup.

---

## Security notes

- **No authentication.** Anyone who can reach the API can start ingestion runs. Only one can run at a time, but put the API behind authentication or rate limiting before exposing it publicly.
- **Credentials stay server-side.** Database credentials live only in `backend/.env` and `scraper/.env`, which git ignores. Error responses and stored job errors never include connection strings.
