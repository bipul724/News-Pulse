# News Pulse — Architecture

## 1. Architecture Goal

Keep the architecture simple enough to finish in 2 days while clearly separating the three required technologies:

- Python = ingestion + extraction + clustering
- Node.js = REST API + ingestion job control
- Next.js = UI + timeline visualization

The assessment specifically asks for clearly separated `/scraper`, `/backend`, and `/frontend` folders.

---

## 2. High-Level Architecture

```text
                    ┌─────────────────────┐
                    │   Public RSS Feeds  │
                    │ BBC / NPR / Source3 │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Python Scraper    │
                    │                     │
                    │ feedparser           │
                    │ normalize            │
                    │ extract article      │
                    │ deduplicate          │
                    │ TF-IDF clustering    │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ PostgreSQL / Neon   │
                    │                     │
                    │ articles            │
                    │ clusters            │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Node.js / Express   │
                    │ REST API            │
                    │                     │
                    │ /clusters           │
                    │ /clusters/:id       │
                    │ /timeline           │
                    │ /ingest/trigger     │
                    │ /ingest/status/:id  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Next.js / React     │
                    │                     │
                    │ Timeline             │
                    │ Source filters      │
                    │ Cluster details     │
                    │ Refresh             │
                    └─────────────────────┘
```

---

## 3. Repository Structure

```text
news-pulse/
├── scraper/
│   ├── src/
│   │   ├── feeds.py
│   │   ├── normalize.py
│   │   ├── extractor.py
│   │   ├── dedupe.py
│   │   ├── cluster.py
│   │   ├── database.py
│   │   └── main.py
│   ├── requirements.txt
│   └── README.md
│
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── routes/
│   │   │   ├── clusters.js
│   │   │   ├── timeline.js
│   │   │   └── ingestion.js
│   │   ├── services/
│   │   │   ├── database.js
│   │   │   └── ingestionJob.js
│   │   └── utils/
│   │       └── errors.js
│   ├── package.json
│   └── Dockerfile
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── components/
│   │       ├── Timeline.tsx
│   │       ├── ClusterCard.tsx
│   │       ├── ClusterDrawer.tsx
│   │       ├── SourceFilter.tsx
│   │       └── RefreshButton.tsx
│   ├── lib/
│   │   └── api.ts
│   └── package.json
│
├── README.md
├── architecture.md
├── prd.md
├── rules.md
├── design.md
├── tasks.md
└── memory.md
```

---

## 4. Database Design

Use PostgreSQL.

### `articles`

```text
id                 UUID / serial
source             VARCHAR
title              TEXT
summary            TEXT
body               TEXT nullable
url                TEXT UNIQUE
published_at       TIMESTAMP
content_hash       TEXT UNIQUE
cluster_id         FK
created_at         TIMESTAMP
```

### `clusters`

```text
id                 UUID / serial
label              TEXT
created_at         TIMESTAMP
```

The important constraint is that the same article should not be inserted repeatedly.

---

## 5. Python Pipeline

```text
start
  ↓
load RSS source configuration
  ↓
fetch each RSS feed
  ↓
normalize RSS fields
  ↓
check article URL/hash
  ↓
skip already-known article
  ↓
fetch article page
  ↓
extract body
  ↓
store article
  ↓
build clustering text
  ↓
TF-IDF
  ↓
cosine similarity
  ↓
assign cluster
  ↓
generate cluster label
  ↓
persist cluster relationship
  ↓
finish
```

If one feed or article fails, log the error and continue processing other items.

---

## 6. Clustering Architecture

Recommended implementation:

1. Combine `title + summary`.
2. Normalize text.
3. Remove English stop words.
4. Create TF-IDF vectors.
5. Calculate cosine similarity.
6. Compare against a configurable threshold.
7. Put sufficiently similar articles into the same cluster.
8. Generate a label from representative/top terms.

Keep the threshold in configuration, for example:

```text
CLUSTER_SIMILARITY_THRESHOLD=0.35
```

Do not claim that `0.35` is universally correct. Explain in README that it was selected experimentally using the collected articles.

---

## 7. Node Ingestion Job

`POST /ingest/trigger` should:

1. generate a job ID;
2. mark job as `queued/running`;
3. start the Python process;
4. immediately return the job ID;
5. update job state when Python exits.

Example:

```json
{
  "jobId": "ingest-172345",
  "status": "running"
}
```

Then:

```text
GET /ingest/status/ingest-172345
```

returns:

```json
{
  "jobId": "ingest-172345",
  "status": "completed"
}
```

Possible states:

```text
queued
running
completed
failed
```

For a 2-day project, an in-memory job map is acceptable for a single backend instance. Document this as a limitation.

---

## 8. API Contract

### GET `/clusters`

```json
[
  {
    "id": "1",
    "label": "Markets",
    "articleCount": 5,
    "start": "...",
    "end": "..."
  }
]
```

### GET `/clusters/:id`

```json
{
  "id": "1",
  "label": "Markets",
  "articles": [
    {
      "title": "...",
      "source": "BBC",
      "publishedAt": "...",
      "url": "..."
    }
  ]
}
```

Sort articles chronologically.

### GET `/timeline`

Return chart-ready objects:

```json
[
  {
    "id": "1",
    "label": "Markets",
    "start": "...",
    "end": "...",
    "articleCount": 5,
    "intensity": 5
  }
]
```

### POST `/ingest/trigger`

Starts ingestion and returns a job ID.

### GET `/ingest/status/:jobId`

Returns current ingestion status.

---

## 9. Deployment Architecture

Recommended:

```text
Vercel
  └── Next.js frontend

Render
  └── Node.js backend
       └── Python runtime/process
            └── Neon PostgreSQL

Neon
  └── persistent database
```

Because the Node API must trigger the Python pipeline, the simplest deployment is to package Node + Python in the same backend container.

The exact hosting mechanism is an implementation choice; the assessment only requires the full system to be live.

---

## 10. Environment Variables

Frontend:

```text
NEXT_PUBLIC_API_URL
```

Backend:

```text
DATABASE_URL
PYTHON_PATH
PORT
```

Scraper:

```text
DATABASE_URL
CLUSTER_SIMILARITY_THRESHOLD
```

Never commit secrets.

---

## 11. Important Design Decision

Do not introduce:

- Redis,
- Kafka,
- Kubernetes,
- a separate queue service,
- microservices,
- embeddings/vector databases,

unless absolutely necessary.

The assessment is evaluating engineering judgment. A small reliable architecture is preferable to infrastructure that consumes the two-day deadline.
