# News Pulse — Development Rules

These rules are for the implementation phase. They are intentionally optimized for a 2-day deadline.

## 1. Scope Rules

### MUST

- Finish every mandatory requirement before stretch goals.
- Keep `/scraper`, `/backend`, and `/frontend` clearly separated.
- Keep the application runnable locally.
- Keep the deployed application functional.
- Document assumptions in README.

### MUST NOT

- Add authentication unless needed.
- Add a complex distributed architecture.
- Build a custom ML system.
- Spend significant time on optional cross-source story merging.
- Add features that are not needed for the assessment before the MVP works.

---

## 2. Python Rules

- Use at least 3 public RSS feeds.
- Normalize all feeds into one internal article schema.
- Never assume every feed has identical fields.
- Handle missing publication dates.
- Prefer `content:encoded` when available, otherwise fall back to description/summary.
- Article extraction failures must not crash the entire ingestion run.
- Log failures with source and URL.
- Use stable URL/hash based deduplication.
- Make ingestion idempotent where practical.
- Do not insert duplicate articles.
- Keep clustering deterministic where possible.

---

## 3. Clustering Rules

Use TF-IDF + cosine similarity.

### Input

Minimum:

```text
headline + summary
```

### Processing

```text
lowercase
→ tokenize
→ remove stop words
→ TF-IDF
→ cosine similarity
```

### Configuration

Keep threshold configurable.

Do not hardcode the explanation around one magic number. Explain that the threshold was tested against the collected sample.

### Cluster labels

Use top representative TF-IDF terms or the most representative headline.

Labels should be human-readable.

---

## 4. Backend Rules

- Use Express.
- Validate route parameters.
- Return JSON.
- Use meaningful HTTP status codes.
- Return `404` when a cluster/job does not exist.
- Return `400` for invalid input.
- Return `500` only for unexpected server failures.
- Never expose database credentials.
- Use environment variables.
- Keep API response shapes stable.
- Keep timeline responses chart-ready.

---

## 5. Ingestion Job Rules

`POST /ingest/trigger` must not wait for the whole scraper to finish.

Flow:

```text
request
→ create job ID
→ start Python
→ return job ID
```

Frontend then polls:

```text
GET /ingest/status/:jobId
```

When status becomes `completed`:

```text
GET /timeline
```

---

## 6. Frontend Rules

The timeline is the main product.

Do not make the homepage look like:

```text
Article 1
Article 2
Article 3
```

It must communicate:

> this topic was active during this time window.

Required interactions:

- click cluster;
- inspect articles;
- filter by source;
- refresh data.

---

## 7. UI Rules

Prioritize:

1. readable timeline;
2. clear time axis;
3. recognizable cluster markers;
4. useful cluster detail;
5. source filtering;
6. loading/error/empty states.

Avoid:

- excessive animations;
- unnecessary dashboards;
- decorative elements that make the timeline harder to read.

---

## 8. Error Handling

Frontend must handle:

- API unavailable;
- timeline loading;
- cluster loading;
- refresh running;
- refresh failed;
- no articles;
- no clusters;
- invalid cluster ID.

Backend must handle:

- database errors;
- scraper process errors;
- unknown job ID;
- unknown cluster ID.

---

## 9. Code Rules

- Prefer small modules.
- Use descriptive names.
- Avoid giant files.
- Keep database access separate from route handlers.
- Keep clustering separate from RSS parsing.
- Keep UI components separate from API calls.
- Do not duplicate API URLs throughout the frontend.

---

## 10. Documentation Rules

README must explain:

- project purpose;
- setup;
- architecture;
- environment variables;
- news sources;
- clustering approach;
- threshold selection;
- one limitation;
- deployment;
- live URLs.

The assessment explicitly asks for these items.

---

## 11. Two-Day Priority Rule

Priority order:

```text
P0 = mandatory functionality
P1 = polish + reliability
P2 = stretch goals
```

If time becomes limited:

```text
P0 first
→ deploy
→ test
→ video
→ optional features only if time remains
```
