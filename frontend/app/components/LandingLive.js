"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { registerSources, shortSource, sourceColor, timeAgo } from '../lib/format';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const HOUR = 3600000;

// Shown when the API is unreachable, clearly labelled as sample data.
const SAMPLE_TOPICS = [
  { label: 'U.N. General Assembly opens amid new conflicts', startH: 30, endH: 8, articleCount: 13, sources: ['BBC News', 'NPR Topics: World', 'NYT > World News'] },
  { label: 'US and Iran hold first talks since June', startH: 16, endH: 1, articleCount: 11, sources: ['BBC News', 'NYT > World News'] },
  { label: 'Why the Bab al-Mandab Strait matters', startH: 26, endH: 18, articleCount: 6, sources: ['BBC News', 'NPR Topics: World'] },
  { label: 'Vietnam warns of threats to trade', startH: 22, endH: 14, articleCount: 5, sources: ['NYT > World News'] },
  { label: 'Mexico restricts phones in schools', startH: 12, endH: 7, articleCount: 3, sources: ['NPR Topics: World', 'NYT > World News'] },
  { label: 'Typhoon grounds flights in Hong Kong', startH: 6, endH: 5.5, articleCount: 2, sources: ['BBC News'] },
];

function buildSample() {
  const now = Date.now();
  const max = Math.max(...SAMPLE_TOPICS.map(t => t.articleCount));
  return SAMPLE_TOPICS.map((t, i) => ({
    id: `sample-${i}`,
    label: t.label,
    start: new Date(now - t.startH * HOUR).toISOString(),
    end: new Date(now - t.endH * HOUR).toISOString(),
    articleCount: t.articleCount,
    intensity: t.articleCount / max,
    sources: t.sources.map((name, j) => ({
      name,
      count: Math.floor(t.articleCount / t.sources.length) + (j < t.articleCount % t.sources.length ? 1 : 0),
    })),
  }));
}

let pending = null;
function loadTimeline() {
  pending ??= fetch(`${API_URL}/timeline`)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      const timeline = (data.timeline || []).filter(c => c.start && c.end);
      if (!timeline.length) throw new Error('empty');
      return { status: 'live', timeline };
    })
    .catch(() => ({ status: 'sample', timeline: buildSample() }));
  return pending;
}

function useLiveTimeline() {
  const [state, setState] = useState({ status: 'loading', timeline: [] });
  useEffect(() => {
    let active = true;
    loadTimeline().then(result => {
      if (!active) return;
      const names = new Set(result.timeline.flatMap(c => c.sources?.map(s => s.name) || []));
      registerSources(names);
      setState(result);
    });
    return () => { active = false; };
  }, []);
  return state;
}

function summarize(timeline) {
  const sourceMap = new Map();
  timeline.forEach(c => c.sources?.forEach(s => sourceMap.set(s.name, (sourceMap.get(s.name) || 0) + s.count)));
  return {
    topics: timeline.length,
    articles: timeline.reduce((sum, c) => sum + c.articleCount, 0),
    sources: [...sourceMap.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    multiSource: timeline.filter(c => (c.sources?.length || 0) > 1).length,
    latest: Math.max(...timeline.map(c => new Date(c.end).getTime())),
  };
}

export function StatusPill() {
  const { status } = useLiveTimeline();
  const styles = {
    loading: ['bg-stone-100 text-stone-500', 'bg-stone-400', 'Connecting'],
    live: ['bg-emerald-50 text-emerald-700 border-emerald-100', 'bg-emerald-500 animate-pulse', 'API live'],
    sample: ['bg-amber-50 text-amber-700 border-amber-100', 'bg-amber-500', 'API offline'],
  }[status];
  return (
    <span className={`hidden sm:flex items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 text-[11px] font-semibold ${styles[0]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${styles[1]}`} />
      {styles[2]}
    </span>
  );
}

export function HeroPreview() {
  const { status, timeline } = useLiveTimeline();

  if (status === 'loading') {
    return (
      <PreviewFrame status={status}>
        <div className="animate-pulse space-y-3 p-6">
          {[70, 45, 60, 35, 50].map((w, i) => (
            <div key={i} className="h-6 rounded-md bg-stone-100" style={{ width: `${w}%`, marginLeft: `${(i * 9) % 40}%` }} />
          ))}
        </div>
      </PreviewFrame>
    );
  }

  const stats = summarize(timeline);
  const top = [...timeline]
    .sort((a, b) => b.articleCount - a.articleCount || new Date(b.end) - new Date(a.end))
    .slice(0, 6);

  return (
    <PreviewFrame status={status}>
      <MiniTimeline clusters={top} live={status === 'live'} />
      <div className="grid grid-cols-2 divide-stone-100 border-t border-stone-100 sm:grid-cols-4 sm:divide-x">
        <Stat label="Topics" value={stats.topics} />
        <Stat label="Articles" value={stats.articles} />
        <Stat label="Multi-source topics" value={stats.multiSource} />
        <Stat label="Latest article" value={timeAgo(stats.latest)} />
      </div>
    </PreviewFrame>
  );
}

function PreviewFrame({ status, children }) {
  return (
    <div className="relative mx-auto mt-14 w-full max-w-5xl text-left">
      <div className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-[0_1px_0_#d6d3d1,0_12px_32px_-16px_rgba(28,25,23,0.25)]">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
          <div className="font-display text-base font-semibold text-stone-900">
            Biggest stories right now
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            status === 'live' ? 'bg-emerald-50 text-emerald-700' : status === 'sample' ? 'bg-amber-50 text-amber-700' : 'bg-stone-100 text-stone-500'
          }`}>
            {status === 'live' ? 'Live data' : status === 'sample' ? 'Sample data · API offline' : 'Loading'}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{label}</div>
      <div className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-stone-900">{value}</div>
    </div>
  );
}

function SourceDots({ sources }) {
  return (
    <span className="flex items-center gap-1">
      {sources?.map(s => (
        <span key={s.name} title={s.name} className={`h-2 w-2 rounded-full ${sourceColor(s.name).dot}`} />
      ))}
    </span>
  );
}

// Links a topic to its drawer on the timeline page; sample topics have no real id.
function TopicLink({ live, id, className, children }) {
  if (!live) return <div className={className}>{children}</div>;
  return <Link href={`/timeline?topic=${id}`} className={className}>{children}</Link>;
}

function MiniTimeline({ clusters, live }) {
  const starts = clusters.map(c => new Date(c.start).getTime());
  const ends = clusters.map(c => new Date(c.end).getTime());
  const rawMin = Math.min(...starts);
  const rawMax = Math.max(...ends);
  const pad = Math.max(rawMax - rawMin, HOUR) * 0.04;
  const min = rawMin - pad;
  const span = rawMax + pad - min;
  const pct = t => ((t - min) / span) * 100;
  const ticks = [0.15, 0.5, 0.85].map(f => min + span * f);
  const multiDay = span > 20 * HOUR;
  const tickLabel = t => new Date(t).toLocaleString([], multiDay ? { weekday: 'short', hour: 'numeric' } : { hour: 'numeric', minute: '2-digit' });

  // Label column + time track: titles never overlap or get clipped by bars.
  const grid = 'grid gap-x-6 gap-y-1.5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-center';

  return (
    <div>
      <div className={`${grid} hidden border-b border-stone-100 px-5 py-2 md:grid`}>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Topic</span>
        <div className="relative h-4">
          {ticks.map(t => (
            <span key={t} className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-stone-400" style={{ left: `${pct(t)}%` }}>
              {tickLabel(t)}
            </span>
          ))}
        </div>
      </div>
      <ol className="divide-y divide-stone-100">
        {clusters.map(c => {
          const left = pct(new Date(c.start).getTime());
          const width = Math.max(pct(new Date(c.end).getTime()) - left, 1.5);
          return (
            <li key={c.id}>
              <TopicLink live={live} id={c.id} className={`${grid} group px-5 py-3 transition-colors ${live ? 'hover:bg-paper' : ''}`}>
                <div className="min-w-0">
                  <div className={`truncate text-sm font-semibold text-stone-900 ${live ? 'group-hover:text-accent-700' : ''}`} title={c.label}>
                    {c.label}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-stone-500">
                    <SourceDots sources={c.sources} />
                    <span className="tabular-nums">{c.articleCount} articles</span>
                    <span aria-hidden="true">·</span>
                    <span>updated {timeAgo(c.end)}</span>
                  </div>
                </div>
                <div className="relative mt-1 h-2 rounded-full bg-stone-100 md:mt-0" aria-hidden="true">
                  {ticks.map(t => (
                    <span key={t} className="absolute -top-1 -bottom-1 hidden w-px bg-stone-200 md:block" style={{ left: `${pct(t)}%` }} />
                  ))}
                  <span className="absolute inset-y-0 rounded-full bg-accent-500" style={{ left: `${left}%`, width: `${width}%` }} />
                </div>
              </TopicLink>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function LiveTopics() {
  const { status, timeline } = useLiveTimeline();

  if (status === 'loading') {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map(i => <div key={i} className="h-40 animate-pulse rounded-xl bg-white/70" />)}
      </div>
    );
  }

  const live = status === 'live';
  const topics = [...timeline]
    .filter(c => (c.sources?.length || 0) > 1)
    .sort((a, b) => new Date(b.end) - new Date(a.end))
    .slice(0, 6);

  if (!topics.length) {
    return <p className="text-center text-sm text-stone-500">No story has been covered by more than one outlet yet.</p>;
  }

  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {topics.map((c, i) => (
        // Phones get the four most recent; wider screens fill a 3-column grid.
        <li key={c.id} className={i >= 4 ? 'hidden sm:block' : undefined}>
          <TopicLink
            live={live}
            id={c.id}
            className={`group flex h-full flex-col rounded-xl border border-stone-200 bg-white p-5 transition-colors ${live ? 'hover:border-stone-400' : ''}`}
          >
            <div className="mb-3 flex flex-wrap gap-1.5">
              {c.sources.map(s => (
                <span key={s.name} className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${sourceColor(s.name).soft} ${sourceColor(s.name).text}`}>
                  {shortSource(s.name)}
                </span>
              ))}
            </div>
            <h3 className={`font-display text-lg font-semibold leading-snug text-stone-900 ${live ? 'group-hover:text-accent-700' : ''}`}>
              {c.label}
            </h3>
            <p className="mt-auto pt-4 text-xs text-stone-500">
              <span className="font-semibold tabular-nums text-stone-700">{c.articleCount} articles</span>
              {' · '}updated {timeAgo(c.end)}
            </p>
          </TopicLink>
        </li>
      ))}
    </ol>
  );
}

export function LiveSources() {
  const { status, timeline } = useLiveTimeline();
  if (status === 'loading') {
    return <div className="mx-auto h-24 max-w-3xl animate-pulse rounded-xl bg-white/60" />;
  }
  const { sources, articles } = summarize(timeline);

  return (
    <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-3">
      {sources.map(s => {
        const color = sourceColor(s.name);
        const share = articles ? Math.round((s.count / articles) * 100) : 0;
        return (
          <div key={s.name} className="rounded-xl border border-stone-300 bg-white p-5 text-left">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold text-stone-900">
                <span className={`h-2.5 w-2.5 rounded-full ${color.dot}`} />
                {shortSource(s.name)}
              </span>
              <span className="text-xs font-medium text-stone-400">{status === 'live' ? `${s.count} articles` : 'sample'}</span>
            </div>
            <p className="mt-1 truncate text-xs text-stone-500" title={s.name}>{s.name}</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div className={`h-full rounded-full ${color.dot}`} style={{ width: `${share}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-stone-400">{share}% of coverage</p>
          </div>
        );
      })}
      <Link
        href="/timeline"
        className="sm:col-span-3 mt-2 text-center text-sm font-semibold text-accent-600 hover:text-accent-800"
      >
        Filter the timeline by source →
      </Link>
    </div>
  );
}
