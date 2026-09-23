# News Pulse — Web App

The Next.js front end for News Pulse. It shows live news topics on an interactive timeline and lets you read the articles behind each one. It talks only to the News Pulse API (`/backend`); it never touches the database directly.

![Timeline view](../docs/images/timeline.png)

## Pages

| Route | File | Purpose |
| --- | --- | --- |
| `/` | `app/page.js` | Landing page with a live preview: biggest stories, stories covered by more than one outlet, totals and source shares |
| `/timeline` | `app/timeline/page.js` | The application: stats, filters, timeline or list view, topic drawer, *Refresh Data* |

### `/timeline` features

- **Timeline view.**
  - Each bar spans a topic's first to latest article, and the biggest topics sit on the top rows.
  - Thickness and colour show coverage: bars grow from about 21px (one article) to 30px (the biggest story), and heavy topics get bold titles. Colour tiers are heavy, moderate or light, relative to the largest topic.
  - Titles that don't fit inside a bar are drawn beside it.
  - Zoom from 1× to 6×; hovering a bar shows its time range and sources.
- **List view.** Topic cards sorted by *Biggest* or *Latest*.
- **Filters:**
  - search (press `/` to focus)
  - time range (6h / 24h / 48h / All, counted back from the newest article)
  - "2+ articles only"
  - sources, with *All* and per-source *Only* shortcuts
  - *Reset filters*
- **Topic drawer:**
  - totals and a bar splitting coverage by source
  - a per-source filter
  - articles as a vertical timeline grouped by day, with summaries and links
  - `←` / `→` to move to the previous or next topic, `Esc` to close, *Copy link* to share
- **Shareable links.** The open topic is kept in the URL (`/timeline?topic=<id>`). Links work until the next ingestion rebuilds the topics.
- **Refresh Data.** Starts an ingestion (`POST /ingest/trigger`), polls `GET /ingest/status/:jobId` every 2.5 s, then reloads. If a run is already in progress, it joins that run.
- **Auto-refresh.** The page refetches the timeline every 5 minutes and shows how long ago it last synced.

## Project structure

```text
app/
├── layout.js              root layout; loads the Newsreader serif via next/font
├── globals.css            Tailwind import, theme tokens, scrollbar and drawer animations
├── page.js                landing page (server component; live parts in LandingLive)
├── timeline/page.js       timeline application (client component): data, filters, URL state
├── components/
│   ├── Timeline.js        timeline chart: axis, lane packing, zoom, tooltips
│   ├── ClusterList.js     list-view topic cards
│   ├── ClusterDrawer.js   topic side panel: articles, source filter, keyboard navigation
│   ├── SourceFilter.js    source chips (All / toggle / Only)
│   ├── RefreshButton.js   trigger + poll an ingestion job
│   └── LandingLive.js     landing-page parts that fetch live data (with sample fallback)
└── lib/
    └── format.js          time formatting, source colours, coverage tiers
```

## Data flow

- **Two API calls feed the timeline page.** `GET /timeline` loads every topic, and `GET /clusters/:id` loads one topic's articles when the drawer opens. Filtering, search and sorting all happen in the browser.
- **The landing page fetches `/timeline` once.** The shared promise in `LandingLive.js` serves every live section from that one request.
- **Offline fallback.** If the API is unreachable, the landing page shows clearly labelled sample data, and the timeline page shows an error with *Try again*.

## Design system

The look is a newsprint style: warm paper background, near-black ink, one vermilion accent, and a serif for headlines. The tokens are defined once in `app/globals.css` (Tailwind 4 `@theme`):

| Token | Use |
| --- | --- |
| `paper` (`#f6f4ef`) | Page background |
| `stone-*` (Tailwind) | Text, borders, surfaces |
| `accent-50` … `accent-950` (vermilion) | Links, "Now" marker, heavy-coverage bars, highlights |
| `font-display` (Newsreader) | Headlines |

- **Coverage colours.** `coverageTier(intensity)` and `TIER_STYLES` in `lib/format.js` are shared by the timeline chart and the landing page, so both always agree: above 0.6 is heavy, above 0.3 moderate, otherwise light.
- **Source colours.** `registerSources()` gives each source a stable muted colour, assigned alphabetically, which is used for dots, tags and coverage bars everywhere.

To change the accent colour, edit the `--color-accent-*` values in `globals.css`.

## Setup

Requires Node.js 20+ and a running API (see the [root README](../README.md#getting-started)).

```bash
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:5001" > .env
npm run dev          # http://localhost:3000
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:5001` | Base URL of the News Pulse API. It is read at build time, so rebuild after changing it |

The API only accepts requests from its `FRONTEND_URL` (CORS). Set that to this app's origin when deploying.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (Next.js rules + React Compiler checks) |

## Notes for contributors

- **Next.js version.** This project uses Next.js 16. Some APIs differ from older versions; check `node_modules/next/dist/docs/` before relying on older patterns (see `AGENTS.md`).
- **Browser storage.** The view preference is the only thing stored in the browser (`localStorage`, wrapped in `try/catch`). Everything else comes from the API or the URL.
- **Keyboard access.** Timeline bars are buttons, so they can be focused and show their tooltip on focus. The drawer is a labelled dialog that closes with `Esc`.
