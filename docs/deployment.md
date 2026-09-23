# Deploying News Pulse

## What runs where, and why

| Component | Platform | Why |
| --- | --- | --- |
| Web app (`/frontend`) | **Vercel** | Built for Next.js: zero-config builds and a global CDN on the free tier |
| API + scraper (`/backend` + `/scraper`) | **Render**, one Docker web service | The API starts the Python scraper as a subprocess, so both need to live on the same machine. One Docker image holds Node 24 and Python 3.11 |
| Database | **Supabase** PostgreSQL (already in use) | Hosted Postgres; the schema is managed by Prisma migrations |
| Scheduled refresh (optional) | **GitHub Actions** cron | Calls `POST /ingest/trigger` every 6 hours, so the live timeline stays current without anyone pressing *Refresh Data* |

```text
Browser ──► Vercel (Next.js) ──HTTPS──► Render (Express API ──spawns──► Python scraper) ──► Supabase Postgres
                                              ▲
                          GitHub Actions cron ┘ (POST /ingest/trigger every 6 h)
```

All secrets live in the platforms' environment settings. Nothing secret is committed. `.env` files are git-ignored and excluded from the Docker build by `.dockerignore`.

---

## 1. Database: get the Session pooler URL

> **Important:** Supabase's *direct* connection host (`db.<project-ref>.supabase.co`) is **IPv6-only**, and Render cannot make outbound IPv6 connections. With that URL the deployed API starts, but `/health/db` returns 503 (this was reproduced in a local container). Use the **Session pooler** URL, which is IPv4.

In Supabase, open **Connect** → **Session pooler** and copy the URI. It looks like:

```text
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

- **Password characters:** if the password contains special characters, they must be percent-encoded in the URL (`@` → `%40`, `#` → `%23`, …).
- **Why Session mode, not Transaction (port 6543):** Session mode behaves like a normal connection, which both Prisma and psycopg expect.

The tables already exist if you have run the app locally. For a brand-new database, run this once from your machine:

```bash
cd backend && npx prisma migrate deploy
```

## 2. API on Render

1. Push the repository to GitHub (the Blueprint reads `render.yaml` from it).
2. In Render: **New** → **Blueprint** → select the repository. It finds `render.yaml` and creates the `news-pulse-api` web service (Docker, free plan).
3. When asked for the secret values, enter:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | the Session pooler URL from step 1 |
   | `FRONTEND_URL` | your Vercel URL, e.g. `https://news-pulse.vercel.app`. Enter a placeholder for now and update it after step 3 |

   `PORT`, `PYTHON_COMMAND` and `SCRAPER_PATH` are set in the Dockerfile. Render's own `PORT` overrides the default automatically.
4. Wait for the first build. It takes about 5 minutes, most of it installing scikit-learn and SciPy.
5. Check it:
   ```bash
   curl https://<your-api>.onrender.com/health       # {"status":"ok",...}
   curl https://<your-api>.onrender.com/health/db    # {"status":"ok","database":"connected"}
   ```

**Without Blueprints:** create a *Web Service* from the repo manually with **Runtime** = Docker, **Dockerfile path** = `backend/Dockerfile`, **Docker build context** = `.` (repository root), **Health check path** = `/health`, and the two variables above.

## 3. Web app on Vercel

1. In Vercel: **Add New** → **Project** → import the repository.
2. Set **Root Directory** to `frontend`. The framework is detected as Next.js; keep the default build settings.
3. Add the environment variable:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_API_URL` | `https://<your-api>.onrender.com` (no trailing slash) |

   It is compiled into the site at build time, so redeploy after changing it.
4. Deploy, then copy the production URL.
5. In Render, set `FRONTEND_URL` to that URL. The API accepts a comma-separated list if you also want preview deployments to work, e.g. `https://news-pulse.vercel.app,https://news-pulse-git-main-<you>.vercel.app`. Render redeploys automatically.

## 4. Optional: scheduled refresh

In GitHub: **Settings** → **Secrets and variables** → **Actions** → **Variables** → add

```text
NEWS_PULSE_API_URL = https://<your-api>.onrender.com
```

The workflow `.github/workflows/scheduled-ingest.yml` then runs every 6 hours. You can also start it by hand from the **Actions** tab. It retries while a sleeping instance wakes up, and it treats `409` (a run already in progress) as success.

## 5. Verify the live system

1. Open the Vercel URL. The landing page badge should say **API live**, and the preview should show real headlines.
2. Open `/timeline` and press **Refresh Data**. The button shows progress, then *Data Updated*. A run takes 30–60 s.
3. Click a topic. The drawer should list articles with source, time and working links.

## Free-tier behaviour

- **Cold starts.** Render's free web services sleep after 15 minutes without traffic. The first request afterwards takes about a minute; the brief accepts this. The landing page shows labelled sample data until the API answers, and the timeline page shows *Try again*.
- **Job history.** Ingestion jobs are stored in Postgres. If Render restarts the container mid-run, that job is marked `failed` on the next start rather than blocking future runs.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `/health` works, `/health/db` returns 503 | `DATABASE_URL` is the IPv6-only direct host, or the password isn't URL-encoded | Use the Session pooler URL; percent-encode special characters |
| Browser console: *blocked by CORS policy* | `FRONTEND_URL` doesn't exactly match the site's origin | Set it to the exact Vercel URL (scheme included, no path) |
| Landing page says *API offline* | `NEXT_PUBLIC_API_URL` missing or wrong, or the API is still waking up | Fix the variable and redeploy the frontend, or wait a minute |
| Refresh ends in *Refresh failed* | The scraper exited with an error | `GET /ingest/status/<jobId>` shows the last lines of scraper output; Render's logs show everything |
| Render build fails at `npm ci` | `package-lock.json` out of sync (it must include Linux platform packages) | Regenerate it with a current npm: `npm install --package-lock-only` |

## Verified locally

These are the checks that were run to prove the deployment setup works:

- The API image was built and run with Docker and only environment variables, exactly as Render runs it. Through the Session pooler, `/health/db` answered 200. An ingestion then ran inside the container: queued → running → completed in 34 s, with 95 items fetched, 4 inserted and 79 topics rebuilt.
- With the direct IPv6-only URL, the same container returned 503 on `/health/db`. That confirmed the pooler requirement.
- The frontend installs with `npm ci` and builds cleanly on Linux (`node:24`), as Vercel builds it.
