import Link from 'next/link';
import { HeroPreview, LiveSources, StatusPill } from './components/LandingLive';
import { TIER_STYLES } from './lib/format';

function Icon({ children, className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const ICONS = {
  rss: <><path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" /></>,
  code: <path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" />,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  server: <><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></>,
  window: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M7 6.5h.01M10 6.5h.01" /></>,
  cluster: <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="8" r="2.5" /><circle cx="10" cy="18" r="2.5" /><path d="M8.4 6.4 15.6 7.6M6.8 8.4l2.4 7.2M16.6 10.2l-5 6" /></>,
  timeline: <path d="M4 6h9M8 12h12M6 18h7" strokeWidth="2.6" />,
  filter: <path d="M3 5h18l-7 8v6l-4-2v-4z" />,
  refresh: <><path d="M20 12a8 8 0 1 1-2.3-5.7L20 8.5" /><path d="M20 4v4.5h-4.5" /></>,
};

function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-stone-200/80 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight text-stone-900">
            <PulseMark />
            News Pulse
          </Link>
          <div className="hidden items-center gap-6 text-sm font-medium text-stone-600 md:flex">
            <a href="#features" className="transition-colors hover:text-stone-900">Features</a>
            <a href="#architecture" className="transition-colors hover:text-stone-900">How it works</a>
            <a href="#reading" className="transition-colors hover:text-stone-900">Reading the timeline</a>
            <a href="#sources" className="transition-colors hover:text-stone-900">Sources</a>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill />
          <Link
            href="/timeline"
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-stone-800"
          >
            Open timeline →
          </Link>
        </div>
      </div>
    </nav>
  );
}

function PulseMark() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-stone-900 text-accent-400">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12h4l2.5-6 5 12 2.5-6h4" />
      </svg>
    </span>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pb-24 pt-20 text-center sm:pt-24">
      <div className="mx-auto flex max-w-4xl flex-col items-center">
        <p className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-accent-600">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
          RSS → topic clusters → timeline
        </p>
        <h1 className="mb-6 font-display text-5xl font-medium leading-[1.02] tracking-tight text-stone-900 sm:text-6xl md:text-7xl">
          See how the world&apos;s stories
          <span className="block italic text-accent-600">rise, overlap and fade.</span>
        </h1>
        <p className="mb-10 max-w-2xl text-lg leading-relaxed text-stone-600">
          News Pulse pulls live articles from BBC, NPR and The New York Times, groups the ones about the same event,
          and lays each topic out on a timeline from its first article to its latest.
        </p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/timeline"
            className="rounded-lg bg-stone-900 px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-stone-800"
          >
            Explore the live timeline
          </Link>
          <a
            href="#architecture"
            className="rounded-lg border border-stone-300 bg-transparent px-6 py-3 text-center font-semibold text-stone-700 transition-colors hover:bg-white"
          >
            How it works
          </a>
        </div>
      </div>
      <HeroPreview />
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: 'rss',
      title: 'Live ingestion',
      desc: 'Feeds are fetched, normalized into one schema and deduplicated by URL, so re-running is safe.',
    },
    {
      icon: 'cluster',
      title: 'Topic clustering',
      desc: 'Headlines and summaries are compared with TF-IDF and cosine similarity to group coverage of the same event.',
    },
    {
      icon: 'timeline',
      title: 'Timeline view',
      desc: 'Every topic spans its first to latest article. Colour shows how heavily it was covered.',
    },
    {
      icon: 'filter',
      title: 'Explore by source',
      desc: 'Search, filter by outlet or time range, and open any topic to read the articles behind it.',
    },
  ];

  return (
    <section id="features" className="scroll-mt-20 border-y border-stone-200 bg-white px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="mb-4 font-display text-4xl font-medium tracking-tight text-stone-900">
            News moves fast. Seeing how stories connect is harder.
          </h2>
          <p className="text-lg text-stone-600">
            Instead of another feed of headlines, News Pulse shows what is happening, when it started, and how long it stayed in the news.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(f => (
            <div key={f.title} className="rounded-xl border border-stone-200 bg-paper p-6 transition-colors hover:border-stone-300">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-stone-300 bg-white text-accent-600">
                <Icon>{ICONS[f.icon]}</Icon>
              </div>
              <h3 className="mb-2 font-semibold text-stone-900">{f.title}</h3>
              <p className="text-sm leading-relaxed text-stone-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Architecture() {
  const stages = [
    { icon: 'rss', folder: 'feeds', title: 'RSS feeds', tech: 'BBC · NPR · NYT', points: ['Public world-news feeds', 'Headline, summary, link, time'] },
    { icon: 'code', folder: '/scraper', title: 'Python scraper', tech: 'feedparser · trafilatura · scikit-learn', points: ['Normalize and deduplicate', 'Extract full text where allowed', 'TF-IDF + cosine clustering'] },
    { icon: 'database', folder: 'PostgreSQL', title: 'Database', tech: 'Article · Cluster', points: ['Articles linked to clusters', 'Idempotent inserts by URL'] },
    { icon: 'server', folder: '/backend', title: 'REST API', tech: 'Express · Prisma', points: ['Timeline and cluster endpoints', 'Runs and tracks ingestion jobs'] },
    { icon: 'window', folder: '/frontend', title: 'Web app', tech: 'Next.js · React', points: ['Interactive timeline', 'Filters, search, topic drawer'] },
  ];

  const endpoints = [
    ['GET', '/timeline', 'Topics with start, end, article count and sources'],
    ['GET', '/clusters/:id', 'One topic with its articles'],
    ['POST', '/ingest/trigger', 'Start a scraper run in the background'],
    ['GET', '/ingest/status/:jobId', 'Poll until the run completes'],
  ];

  return (
    <section id="architecture" className="scroll-mt-16 bg-stone-950 px-4 py-24 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-accent-400">How it works</p>
          <h2 className="mb-4 font-display text-4xl font-medium tracking-tight">From feed to timeline in five steps</h2>
          <p className="text-stone-400">
            Three separate services, each with one job: Python collects and groups, Node serves, Next.js visualizes.
          </p>
        </div>

        <ol className="grid gap-4 md:grid-cols-5">
          {stages.map((s, i) => (
            <li key={s.title} className="relative">
              {i < stages.length - 1 && (
                <span className="absolute -right-3 top-9 z-10 hidden text-stone-600 md:block" aria-hidden="true">→</span>
              )}
              <div className="h-full rounded-xl border border-stone-800 bg-stone-900/60 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/10 text-accent-300 ring-1 ring-accent-500/20">
                    <Icon>{ICONS[s.icon]}</Icon>
                  </span>
                  <span className="font-mono text-[10px] text-stone-500">{s.folder}</span>
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-xs font-medium text-accent-300/90">{s.tech}</p>
                <ul className="mt-4 space-y-1.5 text-xs leading-relaxed text-stone-400">
                  {s.points.map(p => <li key={p}>{p}</li>)}
                </ul>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-6 lg:col-span-2">
            <div className="mb-4 flex items-center gap-2 font-semibold">
              <Icon className="h-4 w-4 text-accent-300">{ICONS.refresh}</Icon>
              What &ldquo;Refresh Data&rdquo; does
            </div>
            <ol className="space-y-3 text-sm text-stone-400">
              {[
                'The app asks the API to start an ingestion job.',
                'The API launches the Python scraper in the background.',
                'The scraper stores new articles and rebuilds the clusters.',
                'The app polls the job status, then reloads the timeline.',
              ].map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-600 text-[10px] font-bold text-white">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <div className="overflow-hidden rounded-xl border border-stone-800 bg-stone-900/60 lg:col-span-3">
            <div className="border-b border-stone-800 px-6 py-4 font-semibold">API endpoints</div>
            <ul className="divide-y divide-stone-800">
              {endpoints.map(([method, path, desc]) => (
                <li key={path} className="flex flex-col gap-1 px-6 py-3 sm:flex-row sm:items-center sm:gap-4">
                  <code className="flex shrink-0 items-center gap-2 font-mono text-sm sm:w-56">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${method === 'POST' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                      {method}
                    </span>
                    <span className="text-stone-200">{path}</span>
                  </code>
                  <span className="text-sm text-stone-400">{desc}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReadingTheTimeline() {
  const rows = [
    { tier: 'high', left: 6, width: 58, label: 'Summit talks', count: 13, inside: true },
    { tier: 'medium', left: 30, width: 26, label: 'Trade dispute', count: 6 },
    { tier: 'low', left: 70, width: 3, label: 'Breaking: earthquake', count: 1 },
  ];
  const legend = [
    { tier: 'high', label: 'Heavy coverage' },
    { tier: 'medium', label: 'Moderate' },
    { tier: 'low', label: 'Light' },
  ];

  return (
    <section id="reading" className="scroll-mt-16 px-4 py-24">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-14 lg:flex-row">
        <div className="flex-1 space-y-6">
          <p className="text-xs font-bold uppercase tracking-widest text-accent-600">Reading the timeline</p>
          <h2 className="font-display text-4xl font-medium tracking-tight text-stone-900">
            Not just what happened.
            <br />
            When, and for how long.
          </h2>
          <p className="text-lg leading-relaxed text-stone-600">
            Each bar is one topic cluster. Read it the way you read a calendar.
          </p>
          <dl className="space-y-4 text-sm">
            {[
              ['Position', 'when the first article about the topic was published.'],
              ['Length', 'how long the story kept getting new coverage.'],
              ['Colour', 'how many articles it gathered compared with the biggest story.'],
              ['Top rows', 'the biggest stories are always placed first.'],
            ].map(([term, desc]) => (
              <div key={term} className="flex gap-3">
                <dt className="w-20 shrink-0 font-semibold text-stone-900">{term}</dt>
                <dd className="text-stone-600">{desc}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="w-full flex-1">
          <div className="rounded-xl border border-stone-300 bg-white p-6">
            <div className="mb-4 flex justify-between border-b border-stone-100 pb-2 text-[10px] font-medium text-stone-400">
              <span>Mon</span><span>Tue</span><span>Wed</span>
            </div>
            <div className="space-y-3">
              {rows.map(r => {
                const styles = TIER_STYLES[r.tier];
                return (
                  <div key={r.label} className="relative h-8">
                    <div className={`absolute flex h-8 items-center gap-2 rounded-md border px-3 shadow-sm ${styles.bar}`} style={{ left: `${r.left}%`, width: `${r.width}%` }}>
                      {r.inside && (
                        <>
                          <span className="truncate text-xs font-semibold">{r.label}</span>
                          <span className={`ml-auto rounded px-1.5 text-[10px] font-bold ${styles.badge}`}>{r.count}</span>
                        </>
                      )}
                    </div>
                    {!r.inside && (
                      <div className="absolute flex h-8 items-center gap-1.5 pl-2 text-xs font-semibold text-stone-700" style={{ left: `${r.left + r.width}%` }}>
                        {r.label}
                        {r.count > 1 && <span className="rounded bg-stone-100 px-1.5 text-[10px] font-bold text-stone-600">{r.count}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-stone-100 pt-4 text-[11px] text-stone-500">
              {legend.map(l => (
                <span key={l.tier} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-4 rounded-sm border ${TIER_STYLES[l.tier].bar}`} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-stone-400">
            Short topics show their title beside the bar so every label stays readable.
          </p>
        </div>
      </div>
    </section>
  );
}

function Sources() {
  return (
    <section id="sources" className="scroll-mt-16 border-t border-stone-200 bg-white px-4 py-20 text-center">
      <div className="mx-auto mb-10 max-w-2xl">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-stone-400">Sources</p>
        <h2 className="mb-3 font-display text-3xl font-medium tracking-tight text-stone-900">Three newsrooms, one view</h2>
        <p className="text-stone-600">
          Stories covered by more than one outlet merge into a single topic, so you can compare how each one reported it.
          Paywalled sites contribute their RSS headline and summary.
        </p>
      </div>
      <LiveSources />
    </section>
  );
}

function CTASection() {
  return (
    <section className="px-4 py-24">
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-xl bg-stone-900 px-8 py-16 text-center">
        <div className="relative">
          <h2 className="mb-4 font-display text-4xl font-medium tracking-tight text-white sm:text-5xl">See the news cycle as it happens.</h2>
          <p className="mx-auto mb-8 max-w-xl text-stone-300">
            Open the timeline, hit Refresh Data to pull the latest articles, and click any topic to read the coverage behind it.
          </p>
          <Link
            href="/timeline"
            className="inline-flex items-center justify-center rounded-lg bg-accent-500 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-accent-400"
          >
            Open the live timeline →
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-stone-200 px-4 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex items-center gap-3">
          <PulseMark />
          <div>
            <div className="font-bold text-stone-900">News Pulse</div>
            <p className="text-xs text-stone-500">Topic-clustered news timeline</p>
          </div>
        </div>
        <div className="flex gap-6 text-sm font-medium text-stone-600">
          <Link href="/timeline" className="hover:text-stone-900">Timeline</Link>
          <a href="#architecture" className="hover:text-stone-900">How it works</a>
          <a href="#sources" className="hover:text-stone-900">Sources</a>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen scroll-smooth bg-paper text-stone-900 selection:bg-accent-100 selection:text-accent-900">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Architecture />
        <ReadingTheTimeline />
        <Sources />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
