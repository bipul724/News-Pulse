# News Pulse — Product Requirements Document

## 1. Project Summary

**Project:** News Pulse — Topic-Clustered News Timeline  
**Assessment:** Xponentium India Full-Stack Developer Internship  
**Deadline:** 2 days for implementation  
**Goal:** Build a live full-stack system that:

1. pulls articles from at least 3 public news RSS feeds,
2. extracts article content,
3. groups related articles into topic clusters,
4. stores the normalized data,
5. exposes the data through a Node.js REST API,
6. displays the clusters as an interactive timeline in Next.js/React,
7. allows users to inspect cluster articles and filter by source,
8. allows users to trigger a fresh ingestion run,
9. is deployed live.

The assessment explicitly says there is no single correct solution and that the reasoning behind decisions matters. Ambiguities should be documented in the README.

---

## 2. Mandatory Scope

### A. Python ingestion and grouping

The Python pipeline MUST:

- use at least 3 different public RSS feeds;
- normalize inconsistent RSS structures;
- handle differences such as `description` vs `content:encoded`;
- handle missing/inconsistent publication dates;
- fetch the actual article page where possible;
- extract the main article body;
- gracefully handle article extraction failures;
- avoid storing the same article twice across repeated runs;
- be re-runnable and preferably process only new articles;
- group related articles into topic clusters;
- store:
  - cluster ID,
  - cluster label,
  - articles belonging to the cluster,
  - article published timestamp.

### B. Node.js API

Required endpoints:

- `GET /clusters`
- `GET /clusters/:id`
- `GET /timeline`
- `POST /ingest/trigger`
- `GET /ingest/status/:jobId`

The API MUST:

- return sensible timeline-oriented data;
- use correct status codes;
- perform reasonable validation/error handling;
- use environment variables for configuration;
- connect to the database used by the Python pipeline.

### C. Next.js / React frontend

The frontend MUST include:

- a visual timeline;
- clusters represented as blocks/markers spanning earliest → latest article;
- a cluster detail view;
- headline, source, published time, and original article link;
- source filters;
- a Refresh Data button;
- refresh flow that triggers ingestion, polls job status, and updates the timeline after completion.

### D. Deployment

The final system MUST be deployed.

Required:

- live frontend URL;
- live backend API URL;
- environment variables configured on hosting;
- README explaining what runs where and why.

### E. Video

A 2–3 minute screen recording is REQUIRED.

Cover:

1. live timeline demo — 30–45 sec;
2. topic grouping implementation — 45–60 sec;
3. one difficult problem and solution — 30–45 sec;
4. one improvement for more time — 15–20 sec.

---

## 3. Non-Mandatory Stretch Goals

Do NOT sacrifice the mandatory MVP for these:

- automatic frontend polling;
- visual cluster sizing;
- cross-source story merging.

The assessment explicitly marks these as optional.

---

## 4. Recommended MVP

For a two-day implementation, build this exact MVP:

### Data flow

RSS feeds
→ Python parser
→ normalized article objects
→ article extraction
→ duplicate check
→ topic grouping
→ PostgreSQL
→ Node.js REST API
→ Next.js timeline

### Recommended stack

- Python
  - `feedparser`
  - `trafilatura`
  - `scikit-learn`
  - `python-dateutil`
  - `psycopg`
- Database
  - PostgreSQL / Neon
- Backend
  - Node.js
  - Express
  - JavaScript/TypeScript
- Frontend
  - Next.js App Router
  - React
  - Tailwind CSS
  - Recharts or a custom timeline
- Deployment
  - Vercel frontend
  - Render backend
  - Neon database

### Clustering choice

Use **TF-IDF + cosine similarity threshold** rather than KMeans.

Reason:

- article count is unknown;
- KMeans requires choosing a number of clusters;
- a similarity threshold maps naturally to "these two articles are related";
- it is easier to explain in the video;
- it avoids overengineering.

Use headline + summary as the minimum clustering text. If full article body extraction succeeds, it can be included carefully, but do not make the entire pipeline depend on body extraction succeeding.

---

## 5. Article Schema

Recommended article fields:

```text
id
source
title
summary
body
url
published_at
content_hash
cluster_id
created_at
```

`content_hash` should be generated from a stable identifier such as normalized URL. This gives a simple duplicate mechanism.

---

## 6. Cluster Schema

Recommended cluster fields:

```text
id
label
created_at
```

Relationship:

```text
Cluster 1
  ├── Article A
  ├── Article B
  └── Article C
```

The API can calculate:

- article count;
- earliest published timestamp;
- latest published timestamp.

---

## 7. Timeline Requirements

Each timeline item should contain enough information for the UI to draw a time-span:

```json
{
  "id": "cluster-123",
  "label": "Global Markets",
  "start": "2026-09-22T06:30:00Z",
  "end": "2026-09-22T10:20:00Z",
  "articleCount": 5,
  "intensity": 5
}
```

`intensity` can initially equal `articleCount`.

This directly satisfies the assessment's requirement for a size/intensity metric without building a complicated scoring system.

---

## 8. Acceptance Criteria

The project is ready for submission when:

- [ ] 3+ RSS sources work.
- [ ] RSS differences are normalized.
- [ ] article body extraction failures do not crash ingestion.
- [ ] repeated ingestion does not duplicate articles.
- [ ] related articles form coherent clusters.
- [ ] clusters have labels.
- [ ] required API endpoints work.
- [ ] timeline data has start/end timestamps.
- [ ] frontend shows a real visual timeline.
- [ ] clicking a cluster shows its articles.
- [ ] source filtering works.
- [ ] Refresh Data triggers ingestion and polls status.
- [ ] frontend is live.
- [ ] backend is live.
- [ ] README is complete.
- [ ] 2–3 minute video is recorded.
- [ ] GitHub repo contains `/scraper`, `/backend`, `/frontend`.
