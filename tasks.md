# News Pulse — 2-Day Implementation Tasks

## Deadline Strategy

You have 2 days, so the goal is:

**Day 1 = working end-to-end MVP**

**Day 2 = integration, deployment, polish, testing, video**

Do not wait until the end to connect the pieces.

---

# DAY 1 — Build the Core

## Phase 1 — Project Setup

### Task 1. Repository

- [ ] Create GitHub repository.
- [ ] Create:
  - [ ] `/scraper`
  - [ ] `/backend`
  - [ ] `/frontend`
- [ ] Add `.gitignore`.
- [ ] Add initial README.
- [ ] Add `.env.example`.

### Task 2. Database

- [ ] Create Neon PostgreSQL database.
- [ ] Create `clusters` table.
- [ ] Create `articles` table.
- [ ] Add unique constraint for article URL/hash.
- [ ] Test connection from Python.
- [ ] Test connection from Node.

**Checkpoint:** Database is working.

---

# Phase 2 — Python Scraper

## Task 3. RSS Sources

Choose 3 public RSS sources.

- [ ] Source 1
- [ ] Source 2
- [ ] Source 3

Implement:

```text
fetch_feed(url)
```

Do not assume all feeds have identical fields.

---

## Task 4. Normalization

Create one internal schema:

```python
{
    "source": "...",
    "title": "...",
    "summary": "...",
    "url": "...",
    "published_at": "..."
}
```

Handle:

- [ ] description;
- [ ] content:encoded;
- [ ] missing dates;
- [ ] inconsistent date formats;
- [ ] missing optional fields.

**Checkpoint:** all feeds produce the same article structure.

---

## Task 5. Article Extraction

Use `trafilatura`.

For every new article:

```text
RSS article
→ request article URL
→ extract main text
```

If extraction fails:

```text
log warning
→ retain headline/summary
→ continue
```

Do NOT fail the whole run.

---

## Task 6. Deduplication

Use normalized URL/content hash.

Before inserting:

```text
article exists?
    yes → skip
    no  → insert
```

Run the scraper twice to verify that the second run does not duplicate articles.

---

## Task 7. TF-IDF Clustering

Implement:

```text
title + summary
→ TF-IDF
→ cosine similarity
→ threshold
→ clusters
```

Test on real collected articles.

Generate a label from representative terms.

**Checkpoint:** manually inspect several clusters and verify they are coherent.

---

# Phase 3 — Node Backend

## Task 8. Express Setup

- [ ] Initialize backend.
- [ ] Add Express.
- [ ] Add database client.
- [ ] Add CORS.
- [ ] Add environment config.
- [ ] Add error middleware.

---

## Task 9. Implement `/clusters`

Return:

- ID;
- label;
- article count;
- earliest timestamp;
- latest timestamp.

---

## Task 10. Implement `/clusters/:id`

Return:

- cluster;
- articles;
- articles sorted chronologically.

---

## Task 11. Implement `/timeline`

Return chart-ready:

```text
id
label
start
end
articleCount
intensity
```

---

## Task 12. Implement Ingestion Jobs

Implement:

```text
POST /ingest/trigger
GET /ingest/status/:jobId
```

The trigger should:

1. create job ID;
2. spawn Python;
3. return immediately;
4. track status.

**Checkpoint:** use curl/Postman to trigger the scraper.

---

# DAY 2 — Frontend + Deployment + Submission

# Phase 4 — Next.js Frontend

## Task 13. Next.js Setup

- [ ] Create frontend.
- [ ] Configure API URL.
- [ ] Add Tailwind if desired.
- [ ] Create API client.

---

## Task 14. Timeline

Build the main timeline.

Requirements:

- [ ] horizontal time axis;
- [ ] cluster blocks/markers;
- [ ] start/end span;
- [ ] label;
- [ ] article count/intensity.

This is the highest-priority frontend task.

---

## Task 15. Cluster Details

Click cluster:

```text
cluster
→ detail drawer
→ articles
```

Each article shows:

- [ ] headline;
- [ ] source;
- [ ] published time;
- [ ] original link.

---

## Task 16. Source Filtering

Implement:

```text
All
BBC
NPR
Source 3
```

Make filters affect the visible timeline/data.

---

## Task 17. Refresh

Implement:

```text
click Refresh
→ POST /ingest/trigger
→ receive jobId
→ poll status
→ completed
→ GET /timeline
→ update UI
```

Show loading state.

---

# Phase 5 — Integration

## Task 18. End-to-End Test

Run:

```text
Refresh
↓
Python starts
↓
RSS feeds fetched
↓
articles stored
↓
clusters generated
↓
job completes
↓
timeline reloads
```

Test this at least twice.

---

## Task 19. Error Testing

Test:

- [ ] invalid cluster ID;
- [ ] unknown job ID;
- [ ] failed article extraction;
- [ ] backend unavailable;
- [ ] empty database;
- [ ] refresh failure.

---

# Phase 6 — Deployment

## Task 20. Database

- [ ] Neon production DB.
- [ ] Production tables.
- [ ] Production `DATABASE_URL`.

## Task 21. Backend

Deploy Node + Python together.

- [ ] Render/Docker.
- [ ] Configure environment variables.
- [ ] Test health/API.
- [ ] Test ingestion trigger.

## Task 22. Frontend

- [ ] Deploy Next.js to Vercel.
- [ ] Set `NEXT_PUBLIC_API_URL`.
- [ ] Test production frontend.

**Critical:** test the live system from a clean browser.

---

# Phase 7 — README

README must contain:

- [ ] project overview;
- [ ] setup instructions;
- [ ] architecture overview;
- [ ] news sources;
- [ ] clustering approach;
- [ ] threshold selection;
- [ ] one limitation;
- [ ] deployment architecture;
- [ ] environment variables;
- [ ] frontend URL;
- [ ] backend URL;
- [ ] API examples.

---

# Phase 8 — Video

Record 2–3 minutes.

### 0:00–0:40

Live demo:

```text
timeline
→ clusters
→ click cluster
→ article details
→ source filter
```

### 0:40–1:30

Show Python clustering:

```text
RSS
→ normalize
→ TF-IDF
→ cosine similarity
→ cluster
```

### 1:30–2:10

Explain one hard problem.

Recommended:

> RSS feeds were inconsistent and article pages sometimes failed to extract. I normalized feed fields and made article extraction best-effort so one bad article does not stop the ingestion run.

### 2:10–2:30

Explain improvement:

> With more time, I would improve cross-source story merging and make ingestion scheduling more robust.

---

# Final Checklist

- [ ] GitHub repository
- [ ] `/scraper`
- [ ] `/backend`
- [ ] `/frontend`
- [ ] live frontend
- [ ] live backend
- [ ] 3+ RSS feeds
- [ ] article extraction
- [ ] deduplication
- [ ] clustering
- [ ] timeline
- [ ] cluster detail
- [ ] source filter
- [ ] refresh flow
- [ ] README
- [ ] video

---

# Do NOT Do Before MVP

- [ ] Cross-source story merging
- [ ] Auto-refresh
- [ ] Complex authentication
- [ ] Redis
- [ ] Kafka
- [ ] Kubernetes
- [ ] embeddings
- [ ] AI-generated summaries

Finish the required product first.
