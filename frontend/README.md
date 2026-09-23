# News Pulse Frontend

## What it does

The frontend is a topic-clustered news timeline application. It:
- displays the topic timeline using a custom Gantt-style visualization
- loads cluster details and associated articles
- filters visible clusters dynamically by news source
- triggers data ingestion and polls job status until completion

## Requirements

- Node.js 20+
- running backend API server
- backend URL configured in the environment

## Environment

Set the following environment variable (e.g. in `.env`):

```env
NEXT_PUBLIC_API_URL=http://localhost:5001
```

Replace this value with the deployed backend URL in your production environment.

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm start
```

## API endpoints used

The frontend consumes the following REST endpoints exposed by the Node.js backend:
- `GET /timeline`: Fetches aggregated timeline blocks and their intensity.
- `GET /clusters/:id`: Fetches specific articles and data for a given cluster.
- `POST /ingest/trigger`: Initiates the Python ingestion pipeline.
- `GET /ingest/status/:jobId`: Polls the status of the triggered pipeline.

## Frontend architecture

The application is built with Next.js and Tailwind CSS.
- `app/page.js`: The main entry point that fetches the initial timeline data and orchestrates states.
- `app/components/Timeline.js`: The custom chronological visualization of the timeline blocks.
- `app/components/ClusterDrawer.js`: A slide-out panel that dynamically loads and displays a cluster's articles.
- `app/components/SourceFilter.js`: A client-side filter control to select visible news sources.
- `app/components/RefreshButton.js`: A component that handles triggering ingestion and safely polling the job status.
