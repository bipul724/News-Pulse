# News Pulse — Project Memory

This file is the persistent context for future work on the assessment.

## Project

**Name:** News Pulse  
**Company:** Xponentium India  
**Assessment:** Full-Stack Developer Internship  
**Deadline for this implementation plan:** 2 days  
**Assessment format:** Take-home, solo

---

## Core Requirement

Build a system that pulls live articles from multiple RSS feeds, groups related articles into topic clusters, and displays those clusters as a visual timeline.

---

## Required Stack

### Python

Purpose:

- RSS ingestion;
- article extraction;
- topic grouping.

### Node.js

Purpose:

- REST API;
- database access;
- triggering Python ingestion;
- tracking ingestion job status.

### Next.js / React

Purpose:

- visual timeline;
- cluster exploration;
- source filtering;
- refresh interaction.

### Database

PostgreSQL is the recommended implementation choice.

---

## Mandatory API

```text
GET  /clusters
GET  /clusters/:id
GET  /timeline
POST /ingest/trigger
GET  /ingest/status/:jobId
```

---

## Mandatory Frontend

- visual timeline;
- cluster spans earliest → latest article;
- cluster detail;
- article headline;
- article source;
- published time;
- original article link;
- source filter;
- Refresh Data button;
- polling after ingestion;
- timeline update after ingestion.

---

## Mandatory Python

- 3+ public RSS sources;
- normalize feed differences;
- article extraction;
- graceful extraction failures;
- duplicate prevention;
- rerunnable ingestion;
- topic clustering;
- cluster ID;
- cluster label;
- article membership;
- publication timestamp.

---

## Chosen Clustering Approach

**TF-IDF + cosine similarity threshold.**

Reason:

- no need to decide number of clusters;
- simple enough for a 2-day implementation;
- explainable;
- appropriate for a small news dataset.

Primary text:

```text
headline + summary
```

Threshold is configurable and should be justified experimentally in README.

---

## Recommended Deployment

```text
Vercel
└── Next.js

Render
└── Node.js + Python

Neon
└── PostgreSQL
```

The Node service should be able to execute the Python pipeline.

---

## Repository

```text
/scraper
/backend
/frontend
```

This structure is explicitly required by the submission checklist.

---

## Stretch Goals

Only after MVP:

1. auto-refresh;
2. visual cluster sizing;
3. cross-source story merging.

---

## Key Assessment Emphasis

The assessment says the frontend timeline carries significant weight.

Therefore:

> Do not treat the frontend as an API-data dump.

The timeline should visually communicate that a topic was active during a time window.

---

## Video

2–3 minutes:

1. live timeline;
2. clustering explanation;
3. one hard problem + solution;
4. one future improvement.

---

## Current Priority

```text
1. Working scraper
2. Working database
3. Working API
4. Working timeline
5. Refresh integration
6. Deployment
7. README
8. Video
9. Stretch goals
```

---

## Important Engineering Decisions

### Duplicate handling

Use URL/content hash uniqueness.

### Article extraction

Best effort.

If extraction fails:

```text
keep RSS headline + summary
```

and continue.

### Job status

Use:

```text
queued
running
completed
failed
```

For the short assessment, an in-memory job map is acceptable as a documented limitation.

### Timeline intensity

Start with:

```text
intensity = articleCount
```

No complex scoring is required.

### Avoid overengineering

The assessment evaluates approach, ambiguity handling, and communication. A small understandable system is preferable to a large infrastructure-heavy system.

---

## Submission

Final submission must include:

- GitHub repo;
- live frontend URL;
- live backend URL;
- README;
- 2–3 minute video link.

---

## Source Reference

The requirements in this memory were extracted from the uploaded Xponentium India assessment, especially:

- pages 1–3: overview and Python requirements;
- page 4: Node.js API;
- page 5: frontend;
- page 6: deployment;
- page 7: video;
- page 8: submission checklist.
