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
4. Apply the Prisma schema to your database:
   ```bash
   npx prisma db push # Or npx prisma migrate dev
   ```
5. Ensure the Python scraper is available and configure `SCRAPER_PATH` in `.env` if necessary.

## Environment Variables

- `PORT` (default: 5000) - The port the server runs on.
- `DATABASE_URL` - The Supabase PostgreSQL connection string. Must use the direct connection URL for Prisma migrations.
- `FRONTEND_URL` - Used to configure CORS allowing requests from the frontend.
- `PYTHON_COMMAND` - The python executable (e.g., `python` or `python3`).
- `SCRAPER_PATH` - The path to the Python scraper directory, relative to `backend`.

## Database Setup

The backend expects a Supabase PostgreSQL connection string in `DATABASE_URL`. Run `npx prisma db push` or `migrate dev` to apply the Prisma schema.

## Node <-> Python Communication

The Node server triggers the Python scraper using `child_process.spawn`. It runs the scraper asynchronously to avoid blocking API requests. A unique `jobId` is generated, and its status is stored in an in-memory job map, enabling the frontend to poll for ingestion job progress (`GET /ingest/status/:jobId`). Output logs from Python are captured and logged.

## How to Start

- **Development:** `npm run dev` (uses nodemon)
- **Production:** `npm start`
- **Testing:** `npm test`

## API Endpoints

### `GET /health`
Returns service status.

### `GET /clusters`
Returns a list of all topic clusters.

### `GET /clusters/:id`
Returns detailed cluster information along with its related articles.

### `GET /timeline`
Returns chart-friendly timeline data for visualization.

### `POST /ingest/trigger`
Triggers a new Python pipeline ingestion run asynchronously.

### `GET /ingest/status/:jobId`
Gets the status of an ongoing ingestion job.

## Assumptions & Limitations

- For this assessment, authentication and authorization are skipped.
- Concurrency for ingestion runs is restricted. Only one ingestion job can run at a time to prevent conflicts. If another run is attempted, a `409 Conflict` is returned.
- A standard local python binary/environment is assumed for triggering the pipeline.
