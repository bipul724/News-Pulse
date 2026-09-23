"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import Timeline from '../components/Timeline';
import ClusterList from '../components/ClusterList';
import SourceFilter from '../components/SourceFilter';
import ClusterDrawer from '../components/ClusterDrawer';
import RefreshButton from '../components/RefreshButton';
import { registerSources, timeAgo } from '../lib/format';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const AUTO_REFETCH_MS = 5 * 60 * 1000;
const HOUR = 3600000;

const RANGES = [
  { key: '6h', label: '6h', ms: 6 * HOUR },
  { key: '24h', label: '24h', ms: 24 * HOUR },
  { key: '48h', label: '48h', ms: 48 * HOUR },
  { key: 'all', label: 'All', ms: null },
];

const SORTS = [
  { key: 'size', label: 'Biggest' },
  { key: 'recent', label: 'Latest' },
];

function readStored(key, fallback) {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode etc.) — preference just won't persist.
  }
}

export default function TimelinePage() {
  const [timelineData, setTimelineData] = useState([]);
  const [sources, setSources] = useState([]);
  const [selectedSources, setSelectedSources] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const [query, setQuery] = useState('');
  const [range, setRange] = useState('all');
  const [hideSingles, setHideSingles] = useState(false);
  const [view, setView] = useState('timeline');
  const [sort, setSort] = useState('size');
  const [selectedClusterId, setSelectedClusterId] = useState(null);
  const searchRef = useRef(null);
  const knownSources = useRef(new Set());

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/timeline`);
      if (!res.ok) throw new Error('Failed to fetch timeline');
      const data = await res.json();
      const timeline = (data.timeline || []).filter(item => item.start && item.end);

      setTimelineData(timeline);

      const sourceMap = new Map();
      timeline.forEach(item => {
        item.sources?.forEach(s => {
          sourceMap.set(s.name, (sourceMap.get(s.name) || 0) + s.count);
        });
      });
      const sourceList = Array.from(sourceMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      registerSources(sourceList.map(s => s.name));
      setSources(sourceList);

      // Sources seen for the first time start selected so fresh data isn't silently hidden.
      const known = knownSources.current;
      const added = sourceList.filter(s => !known.has(s.name)).map(s => s.name);
      added.forEach(name => known.add(name));
      if (added.length) setSelectedSources(prev => new Set([...prev, ...added]));

      setLastFetched(Date.now());
      setError(null);
    } catch (err) {
      setError('Unable to load the timeline. Check that the News Pulse API is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(fetchTimeline, 0);
    const refetch = setInterval(fetchTimeline, AUTO_REFETCH_MS);
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      clearTimeout(initial);
      clearInterval(refetch);
      clearInterval(tick);
    };
  }, [fetchTimeline]);

  // Restore view preference and a shared ?topic= link on first load.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const storedView = readStored('newsPulse.view', 'timeline');
      if (storedView === 'list' || storedView === 'timeline') setView(storedView);
      const topic = new URLSearchParams(window.location.search).get('topic');
      if (topic) setSelectedClusterId(topic);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const selectCluster = useCallback((id) => {
    setSelectedClusterId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('topic', id);
    else url.searchParams.delete('topic');
    window.history.replaceState(null, '', url);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !(e.target instanceof HTMLElement && e.target.closest('input, textarea'))) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const changeView = (next) => {
    setView(next);
    writeStored('newsPulse.view', next);
  };

  const toggleSource = (name) => {
    const next = new Set(selectedSources);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelectedSources(next);
  };

  // Filters that change which topics exist in the view.
  const filteredTimeline = useMemo(() => {
    const latest = Math.max(0, ...timelineData.map(c => new Date(c.end).getTime()));
    const rangeMs = RANGES.find(r => r.key === range)?.ms;
    return timelineData.filter(item => {
      if (item.sources?.length && !item.sources.some(s => selectedSources.has(s.name))) return false;
      if (hideSingles && item.articleCount < 2) return false;
      if (rangeMs && new Date(item.end).getTime() < latest - rangeMs) return false;
      return true;
    });
  }, [timelineData, selectedSources, hideSingles, range]);

  const trimmedQuery = query.trim().toLowerCase();
  const matchingIds = useMemo(() => {
    if (!trimmedQuery) return null;
    return new Set(
      filteredTimeline
        .filter(c => c.label.toLowerCase().includes(trimmedQuery) || c.sources?.some(s => s.name.toLowerCase().includes(trimmedQuery)))
        .map(c => c.id)
    );
  }, [filteredTimeline, trimmedQuery]);

  const listItems = useMemo(() => {
    const items = matchingIds ? filteredTimeline.filter(c => matchingIds.has(c.id)) : [...filteredTimeline];
    return items.sort((a, b) =>
      sort === 'size'
        ? b.articleCount - a.articleCount || new Date(b.end) - new Date(a.end)
        : new Date(b.end) - new Date(a.end)
    );
  }, [filteredTimeline, matchingIds, sort]);

  // Drawer arrows step through topics in the order the current view shows them.
  const navOrder = useMemo(() => {
    if (view === 'list') return listItems;
    const base = matchingIds ? filteredTimeline.filter(c => matchingIds.has(c.id)) : filteredTimeline;
    return [...base].sort((a, b) => new Date(a.start) - new Date(b.start));
  }, [view, listItems, filteredTimeline, matchingIds]);

  const navIndex = navOrder.findIndex(c => c.id === selectedClusterId);
  const goPrev = navIndex > 0 ? () => selectCluster(navOrder[navIndex - 1].id) : undefined;
  const goNext = navIndex >= 0 && navIndex < navOrder.length - 1 ? () => selectCluster(navOrder[navIndex + 1].id) : undefined;
  const closeDrawer = useCallback(() => selectCluster(null), [selectCluster]);

  const stats = useMemo(() => {
    const articles = filteredTimeline.reduce((sum, c) => sum + c.articleCount, 0);
    const biggest = filteredTimeline.reduce((best, c) => (!best || c.articleCount > best.articleCount ? c : best), null);
    const latest = filteredTimeline.reduce((max, c) => Math.max(max, new Date(c.end).getTime()), 0);
    const multiSource = filteredTimeline.filter(c => (c.sources?.length || 0) > 1).length;
    return { topics: filteredTimeline.length, articles, biggest, latest, multiSource };
  }, [filteredTimeline]);

  const filtersActive = range !== 'all' || hideSingles || trimmedQuery || selectedSources.size < sources.length;
  const resetFilters = () => {
    setRange('all');
    setHideSingles(false);
    setQuery('');
    setSelectedSources(new Set(sources.map(s => s.name)));
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-16 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-8 sm:px-6 lg:px-8">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-1 flex items-center gap-3">
              <Link href="/" className="text-3xl font-bold tracking-tight text-slate-900 transition-colors hover:text-indigo-600">
                News Pulse
              </Link>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Topic-clustered news intelligence
              {lastFetched && <span className="text-slate-400"> · synced {timeAgo(lastFetched, now)}</span>}
            </p>
          </div>
          <RefreshButton onRefreshComplete={fetchTimeline} apiUrl={API_URL} />
        </header>

        {error && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <span>{error}</span>
            <button onClick={fetchTimeline} className="shrink-0 rounded-md bg-red-100 px-3 py-1 font-medium transition-colors hover:bg-red-200">
              Try again
            </button>
          </div>
        )}

        {!loading && timelineData.length > 0 && (
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Topics" value={stats.topics} hint={`${stats.multiSource} covered by 2+ sources`} />
            <StatCard label="Articles" value={stats.articles} hint={`from ${selectedSources.size} of ${sources.length} sources`} />
            <StatCard
              label="Biggest story"
              value={stats.biggest ? `${stats.biggest.articleCount} articles` : '—'}
              hint={stats.biggest?.label}
              onClick={stats.biggest ? () => selectCluster(stats.biggest.id) : undefined}
            />
            <StatCard label="Latest article" value={stats.latest ? timeAgo(stats.latest, now) : '—'} hint={stats.latest ? new Date(stats.latest).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : ''} />
          </section>
        )}

        {sources.length > 0 && (
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="8.5" cy="8.5" r="5.5" />
                  <path d="m13 13 4 4" strokeLinecap="round" />
                </svg>
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Escape' && (setQuery(''), e.currentTarget.blur())}
                  placeholder="Search topics or sources…"
                  aria-label="Search topics"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-24 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  {matchingIds ? `${matchingIds.size} match${matchingIds.size === 1 ? '' : 'es'}` : <kbd className="rounded border border-slate-200 bg-white px-1.5 font-sans">/</kbd>}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Segmented label="Time range" options={RANGES} value={range} onChange={setRange} />
                <label className="flex h-10 cursor-pointer select-none items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-600 hover:bg-slate-50">
                  <input type="checkbox" checked={hideSingles} onChange={e => setHideSingles(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
                  2+ articles only
                </label>
                <Segmented
                  label="View"
                  options={[{ key: 'timeline', label: 'Timeline' }, { key: 'list', label: 'List' }]}
                  value={view}
                  onChange={changeView}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <SourceFilter
                sources={sources}
                selectedSources={selectedSources}
                onToggle={toggleSource}
                onSelectAll={() => setSelectedSources(new Set(sources.map(s => s.name)))}
                onSelectOnly={name => setSelectedSources(new Set([name]))}
              />
              {filtersActive && (
                <button onClick={resetFilters} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                  Reset filters
                </button>
              )}
            </div>
          </div>
        )}

        <section className="flex min-h-[420px] flex-col">
          {loading ? (
            <EmptyCard>
              <div className="w-full max-w-2xl animate-pulse space-y-4">
                <div className="h-6 w-full rounded bg-slate-100" />
                <div className="ml-auto h-8 w-3/4 rounded bg-slate-100" />
                <div className="h-8 w-1/2 rounded bg-slate-100" />
                <div className="ml-12 h-6 w-2/3 rounded bg-slate-100" />
              </div>
            </EmptyCard>
          ) : timelineData.length === 0 ? (
            <EmptyCard>
              <h3 className="mb-2 text-lg font-semibold text-slate-700">No news activity yet</h3>
              <p className="mb-6 max-w-sm text-sm text-slate-500">Run Refresh Data to fetch the latest stories and build the timeline.</p>
              <RefreshButton onRefreshComplete={fetchTimeline} apiUrl={API_URL} />
            </EmptyCard>
          ) : filteredTimeline.length === 0 || (view === 'list' && listItems.length === 0) ? (
            <EmptyCard>
              <h3 className="mb-2 text-base font-semibold text-slate-700">Nothing matches these filters</h3>
              <p className="mb-5 text-sm text-slate-500">Try a wider time range, another source, or a different search.</p>
              <button onClick={resetFilters} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                Reset filters
              </button>
            </EmptyCard>
          ) : view === 'timeline' ? (
            <Timeline
              data={filteredTimeline}
              onSelectCluster={selectCluster}
              selectedClusterId={selectedClusterId}
              highlightIds={matchingIds}
            />
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-700">{listItems.length}</span> topics
                </p>
                <Segmented label="Sort" options={SORTS} value={sort} onChange={setSort} compact />
              </div>
              <ClusterList data={listItems} onSelectCluster={selectCluster} selectedClusterId={selectedClusterId} now={now} />
            </>
          )}
        </section>
      </div>

      {selectedClusterId && (
        <ClusterDrawer
          clusterId={selectedClusterId}
          onClose={closeDrawer}
          onPrev={goPrev}
          onNext={goNext}
          position={navIndex >= 0 ? { index: navIndex, total: navOrder.length } : null}
          apiUrl={API_URL}
        />
      )}
    </main>
  );
}

function StatCard({ label, value, hint, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm ${onClick ? 'transition-colors hover:border-indigo-300 hover:bg-indigo-50/30' : ''}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-slate-900">{value}</div>
      {hint && <div className="mt-1 truncate text-xs text-slate-500" title={hint}>{hint}</div>}
    </Tag>
  );
}

function Segmented({ label, options, value, onChange, compact }) {
  return (
    <div role="group" aria-label={label} className={`flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 ${compact ? 'h-8' : 'h-10'}`}>
      {options.map(opt => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          aria-pressed={value === opt.key}
          className={`h-full rounded-md px-3 text-sm font-medium transition-colors ${
            value === opt.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function EmptyCard({ children }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
      {children}
    </div>
  );
}
