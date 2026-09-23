"use client";

import { useEffect, useRef, useState } from 'react';
import { formatDateTime, formatDuration, formatTime, shortSource, sourceColor, stripHtml } from '../lib/format';

export default function ClusterDrawer({ clusterId, onClose, onPrev, onNext, position, apiUrl }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sourceFilter, setSourceFilter] = useState(null);
  const [copied, setCopied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const closeRef = useRef(null);
  const drawerRef = useRef(null);
  // The topic shown when the drawer closes (←/→ can change it while open).
  const currentIdRef = useRef(clusterId);

  useEffect(() => {
    currentIdRef.current = clusterId;
  }, [clusterId]);

  useEffect(() => {
    let active = true;
    const fetchCluster = async () => {
      try {
        setLoading(true);
        setSourceFilter(null);
        const res = await fetch(`${apiUrl}/clusters/${clusterId}`);
        if (!res.ok) throw new Error('Failed to fetch cluster details');
        const json = await res.json();
        if (active) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError('Unable to load articles for this topic.');
          console.error(err);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    if (clusterId) fetchCluster();
    return () => { active = false; };
  }, [clusterId, apiUrl, reloadKey]);

  // Move focus into the drawer on open, and give it back on close: to the bar or
  // card of the topic being shown, or else to whatever opened the drawer.
  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();
    return () => {
      const topic = document.querySelector(`[data-cluster-id="${currentIdRef.current}"]`);
      const target = topic ?? (opener instanceof HTMLElement && opener.isConnected ? opener : null);
      target?.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Tab') {
        trapFocus(e, drawerRef.current);
        return;
      }
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' || e.key === 'k') onPrev?.();
      else if (e.key === 'ArrowRight' || e.key === 'j') onNext?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error(err);
    }
  };

  const cluster = data?.cluster;
  const articles = data?.articles ?? [];
  const sourceCounts = articles.reduce((acc, a) => {
    acc[a.source] = (acc[a.source] || 0) + 1;
    return acc;
  }, {});
  const sourceEntries = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);
  const visibleArticles = (sourceFilter ? articles.filter(a => a.source === sourceFilter) : articles)
    .map((article, i, list) => ({
      ...article,
      showDay: i === 0 || new Date(list[i - 1].publishedAt).toDateString() !== new Date(article.publishedAt).toDateString(),
    }));
  const start = cluster?.start ? new Date(cluster.start).getTime() : null;
  const end = cluster?.end ? new Date(cluster.end).getTime() : null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-stone-900/30 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />

      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cluster-drawer-title"
        className="fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-stone-200 bg-white shadow-2xl md:w-[520px] animate-slide-in"
      >
        <header className="border-b border-stone-200 px-6 pb-4 pt-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={onPrev}
                disabled={!onPrev}
                aria-label="Previous topic"
                className="h-8 w-8 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                ←
              </button>
              <button
                onClick={onNext}
                disabled={!onNext}
                aria-label="Next topic"
                className="h-8 w-8 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                →
              </button>
              {position && (
                <span className="ml-1 text-xs font-medium tabular-nums text-stone-400">
                  {position.index + 1} of {position.total}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={copyLink}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100"
              >
                {copied ? '✓ Copied' : 'Copy link'}
              </button>
              <button
                ref={closeRef}
                onClick={onClose}
                aria-label="Close"
                className="h-8 w-8 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                ✕
              </button>
            </div>
          </div>

          {loading && !cluster ? (
            <div className="animate-pulse space-y-2">
              <div className="h-6 w-4/5 rounded bg-stone-100" />
              <div className="h-4 w-1/2 rounded bg-stone-100" />
            </div>
          ) : cluster ? (
            <>
              <h2 id="cluster-drawer-title" className="font-display text-2xl font-semibold leading-tight tracking-tight text-stone-900">
                {cluster.label}
              </h2>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <Stat label="Articles" value={cluster.articleCount} />
                <Stat label="Sources" value={sourceEntries.length} />
                <Stat label="Active for" value={formatDuration(end - start)} />
              </dl>
              <p className="mt-3 text-xs text-stone-500">
                {formatDateTime(start)}{end !== start && <> → {formatDateTime(end)}</>}
              </p>

              {sourceEntries.length > 0 && (
                <div className="mt-4">
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-stone-100">
                    {sourceEntries.map(([name, count]) => (
                      <div key={name} className={sourceColor(name).dot} style={{ width: `${(count / articles.length) * 100}%` }} />
                    ))}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <FilterChip active={!sourceFilter} onClick={() => setSourceFilter(null)}>
                      All <span className="opacity-60">{articles.length}</span>
                    </FilterChip>
                    {sourceEntries.map(([name, count]) => (
                      <FilterChip key={name} active={sourceFilter === name} onClick={() => setSourceFilter(sourceFilter === name ? null : name)}>
                        <span className={`h-1.5 w-1.5 rounded-full ${sourceColor(name).dot}`} />
                        {shortSource(name)} <span className="opacity-60">{count}</span>
                      </FilterChip>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <h2 id="cluster-drawer-title" className="text-xl font-bold text-stone-900">Topic details</h2>
          )}
        </header>

        <div className={`flex-1 overflow-y-auto bg-paper px-6 py-5 custom-scrollbar transition-opacity ${loading && cluster ? 'opacity-50' : ''}`}>
          {loading && !cluster && (
            <div className="flex animate-pulse flex-col gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-xl border border-stone-200 bg-white p-5">
                  <div className="mb-3 h-4 w-16 rounded bg-stone-100" />
                  <div className="mb-2 h-5 w-full rounded bg-stone-100" />
                  <div className="h-5 w-3/4 rounded bg-stone-100" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
              <button onClick={() => setReloadKey(k => k + 1)} className="rounded-md bg-red-100 px-3 py-1 text-xs font-semibold hover:bg-red-200">
                Retry
              </button>
            </div>
          )}

          {cluster && !error && (
            <ol className="relative ml-2 border-l-2 border-stone-200">
              {visibleArticles.map(article => {
                const published = new Date(article.publishedAt);
                const showDay = article.showDay;
                const summary = stripHtml(article.summary);
                const color = sourceColor(article.source);
                return (
                  <li key={article.id} className="relative pb-5 pl-6 last:pb-0">
                    {showDay && (
                      <div className="-ml-6 mb-2 pl-6 text-[11px] font-bold uppercase tracking-wider text-stone-400">
                        {published.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                      </div>
                    )}
                    <span className={`absolute -left-[7px] mt-5 h-3 w-3 rounded-full border-2 border-white ${color.dot}`} />
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block rounded-xl border border-stone-200 bg-white p-4 transition-all hover:border-stone-300 hover:shadow-sm"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
                        <span className={`rounded px-1.5 py-0.5 font-bold uppercase tracking-wide ${color.soft} ${color.text}`}>
                          {shortSource(article.source)}
                        </span>
                        <span className="font-medium tabular-nums text-stone-500">{formatTime(published)}</span>
                      </div>
                      <h3 className="font-semibold leading-snug text-stone-900 group-hover:text-accent-700">
                        {article.headline}
                      </h3>
                      {summary && summary !== article.headline && (
                        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-stone-600">{summary}</p>
                      )}
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent-600">
                        Read article <span aria-hidden="true">↗</span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <footer className="hidden border-t border-stone-200 px-6 py-2 text-[11px] text-stone-400 md:block">
          <Kbd>←</Kbd> <Kbd>→</Kbd> switch topics · <Kbd>Esc</Kbd> close
        </footer>
      </aside>
    </>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

// Keeps Tab / Shift+Tab cycling inside the open dialog.
function trapFocus(event, container) {
  if (!container) return;
  const focusable = [...container.querySelectorAll(FOCUSABLE)].filter(el => el.getClientRects().length > 0);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (!container.contains(active)) {
    // Focus escaped (e.g. the focused element was replaced while loading).
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-paper px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-bold text-stone-900">{value}</dd>
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        active ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
      }`}
    >
      {children}
    </button>
  );
}

function Kbd({ children }) {
  return <kbd className="rounded border border-stone-200 bg-paper px-1 font-sans text-[10px] text-stone-500">{children}</kbd>;
}
