"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDateTime, formatDuration, shortSource, sourceColor } from '../lib/format';

const PAD_X = 28;
const ROW_H = 34;
const ROW_GAP = 6;
const LANE_GAP_PX = 14;
const MIN_BAR_PX = 10;
const MAX_LABEL_PX = 340;
const MIN_TICK_SPACING_PX = 110;
const ZOOM_LEVELS = [1, 1.5, 2, 3, 4, 6];

const HOUR = 3600000;
const TICK_INTERVALS = [0.25, 0.5, 1, 2, 3, 6, 12, 24, 48, 168].map(h => h * HOUR);

let measureCtx = null;
function measureLabel(text) {
  if (typeof document !== 'undefined' && !measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d');
    if (measureCtx) {
      const family = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
      measureCtx.font = `600 12px ${family}`;
    }
  }
  const width = measureCtx ? measureCtx.measureText(text).width : text.length * 6.8;
  return Math.min(Math.ceil(width), MAX_LABEL_PX);
}

function tier(intensity = 0) {
  if (intensity > 0.6) return 'high';
  if (intensity > 0.3) return 'medium';
  return 'low';
}

const TIER_STYLES = {
  high: { bar: 'bg-indigo-600 border-indigo-700 text-white', badge: 'bg-white/20 text-white' },
  medium: { bar: 'bg-indigo-200 border-indigo-300 text-indigo-950', badge: 'bg-indigo-950/10 text-indigo-900' },
  low: { bar: 'bg-slate-200 border-slate-300 text-slate-800', badge: 'bg-slate-900/10 text-slate-700' },
};

function buildTicks(minTime, maxTime, pxPerMs) {
  const interval = TICK_INTERVALS.find(i => i * pxPerMs >= MIN_TICK_SPACING_PX) || TICK_INTERVALS.at(-1);
  const cursor = new Date(minTime);
  cursor.setHours(0, 0, 0, 0);
  const ticks = [];
  while (cursor.getTime() <= maxTime) {
    const t = cursor.getTime();
    if (t >= minTime) {
      const isMidnight = cursor.getHours() === 0 && cursor.getMinutes() === 0;
      ticks.push({ t, isMidnight });
    }
    if (interval >= 24 * HOUR) cursor.setDate(cursor.getDate() + interval / (24 * HOUR));
    else cursor.setTime(t + interval);
  }
  return ticks;
}

function formatTick({ t, isMidnight }) {
  const d = new Date(t);
  if (isMidnight) return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return d.toLocaleTimeString([], { hour: 'numeric', minute: d.getMinutes() ? '2-digit' : undefined });
}

export default function Timeline({ data, onSelectCluster, selectedClusterId, highlightIds }) {
  const scrollRef = useRef(null);
  const pendingCenter = useRef(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [zoomIdx, setZoomIdx] = useState(0);
  const [tooltip, setTooltip] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setViewportWidth(entry.contentRect.width));
    observer.observe(el);
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => {
      observer.disconnect();
      clearInterval(timer);
    };
  }, []);

  const zoom = ZOOM_LEVELS[zoomIdx];
  const contentWidth = Math.max(viewportWidth, 720) * zoom;

  const layout = useMemo(() => {
    if (!data?.length || !viewportWidth) return null;

    const starts = data.map(c => new Date(c.start).getTime());
    const ends = data.map(c => new Date(c.end).getTime());
    const rawMin = Math.min(...starts);
    const rawMax = Math.max(...ends);
    const rawSpan = Math.max(rawMax - rawMin, HOUR);
    const minTime = rawMin - rawSpan * 0.03;
    const maxTime = rawMax + rawSpan * 0.03;
    const pxPerMs = (contentWidth - PAD_X * 2) / (maxTime - minTime);
    const toX = t => PAD_X + (t - minTime) * pxPerMs;

    const items = data.map(cluster => {
      const start = new Date(cluster.start).getTime();
      const end = new Date(cluster.end).getTime();
      const x = toX(start);
      const barW = Math.max(MIN_BAR_PX, (end - start) * pxPerMs);
      const badgeW = cluster.articleCount > 1 ? 30 : 0;
      const labelW = measureLabel(cluster.label);
      const inside = labelW + badgeW + 22 <= barW;

      let labelSide = 'inside';
      let occStart = x;
      let occEnd = x + barW;
      if (!inside) {
        const outsideW = labelW + badgeW + 10;
        if (x + barW + outsideW <= contentWidth - 4) {
          labelSide = 'right';
          occEnd = x + barW + outsideW;
        } else {
          labelSide = 'left';
          occStart = x - outsideW;
        }
      }
      return { cluster, x, barW, labelSide, occStart, occEnd };
    });

    // Place the biggest stories first so they settle into the top lanes.
    const ordered = [...items].sort((a, b) =>
      b.cluster.articleCount - a.cluster.articleCount || a.x - b.x
    );
    const lanes = [];
    ordered.forEach(item => {
      let laneIdx = lanes.findIndex(lane =>
        lane.every(o => item.occEnd + LANE_GAP_PX <= o.occStart || item.occStart >= o.occEnd + LANE_GAP_PX)
      );
      if (laneIdx === -1) {
        lanes.push([]);
        laneIdx = lanes.length - 1;
      }
      item.lane = laneIdx;
      lanes[laneIdx].push(item);
    });

    const ticks = buildTicks(minTime, maxTime, pxPerMs).map(tick => ({ ...tick, x: toX(tick.t) }));

    // Alternate shading for each calendar day.
    const days = [];
    const dayCursor = new Date(minTime);
    dayCursor.setHours(0, 0, 0, 0);
    while (dayCursor.getTime() < maxTime) {
      const dayStart = dayCursor.getTime();
      dayCursor.setDate(dayCursor.getDate() + 1);
      const x0 = Math.max(toX(dayStart), 0);
      const x1 = Math.min(toX(dayCursor.getTime()), contentWidth);
      days.push({ key: dayStart, x0, x1, label: new Date(dayStart).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) });
    }

    return { items, laneCount: lanes.length, ticks, days, minTime, maxTime, toX };
  }, [data, viewportWidth, contentWidth]);

  // Keep the viewport centred on the same moment when zooming.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && pendingCenter.current !== null) {
      el.scrollLeft = pendingCenter.current * el.scrollWidth - el.clientWidth / 2;
      pendingCenter.current = null;
    }
  }, [contentWidth]);

  useEffect(() => {
    if (!selectedClusterId) return;
    const el = scrollRef.current?.querySelector(`[data-cluster-id="${selectedClusterId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedClusterId]);

  const changeZoom = (nextIdx) => {
    const el = scrollRef.current;
    const clamped = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, nextIdx));
    if (el && clamped !== zoomIdx) {
      pendingCenter.current = (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth;
    }
    setZoomIdx(clamped);
  };

  const showTooltip = (cluster, rect) => {
    setTooltip({ cluster, x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom });
  };

  const lanesHeight = layout ? layout.laneCount * (ROW_H + ROW_GAP) + 24 : 200;
  const nowX = layout && now >= layout.minTime && now <= layout.maxTime ? layout.toX(now) : null;
  const firstDayLabelVisible = layout && !layout.ticks.some(t => t.isMidnight && t.x < 140);

  return (
    <div className="flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <header className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap gap-3 justify-between items-center">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-tight">Timeline</h2>
          <p className="text-xs text-slate-500 mt-0.5">Each bar spans a topic&apos;s first to latest article. Biggest stories sit on top.</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="Zoom">
          <button
            onClick={() => changeZoom(zoomIdx - 1)}
            disabled={zoomIdx === 0}
            aria-label="Zoom out"
            className="w-7 h-7 rounded-md text-slate-600 hover:bg-white hover:shadow-sm disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:shadow-none font-semibold"
          >
            −
          </button>
          <span className="w-12 text-center text-xs font-semibold tabular-nums text-slate-600">{zoom}×</span>
          <button
            onClick={() => changeZoom(zoomIdx + 1)}
            disabled={zoomIdx === ZOOM_LEVELS.length - 1}
            aria-label="Zoom in"
            className="w-7 h-7 rounded-md text-slate-600 hover:bg-white hover:shadow-sm disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:shadow-none font-semibold"
          >
            +
          </button>
          <button
            onClick={() => changeZoom(0)}
            disabled={zoomIdx === 0}
            className="px-2 h-7 rounded-md text-xs font-semibold text-slate-600 hover:bg-white hover:shadow-sm disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:shadow-none"
          >
            Fit
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="relative overflow-auto custom-scrollbar max-h-[68vh]"
        onScroll={() => tooltip && setTooltip(null)}
      >
        {layout && (
          <div className="relative" style={{ width: contentWidth, height: lanesHeight + 36 }}>
            {/* Day bands */}
            {layout.days.map((day, i) => (
              <div
                key={day.key}
                className={`absolute top-0 bottom-0 ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}
                style={{ left: day.x0, width: Math.max(0, day.x1 - day.x0) }}
              />
            ))}

            {/* Grid lines */}
            {layout.ticks.map(tick => (
              <div
                key={tick.t}
                className={`absolute top-9 bottom-0 w-px ${tick.isMidnight ? 'bg-slate-300' : 'bg-slate-200/70'}`}
                style={{ left: tick.x }}
              />
            ))}

            {/* Axis */}
            <div className="sticky top-0 z-20 h-9 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
              {firstDayLabelVisible && layout.days[0] && (
                <span className="absolute left-3 top-2.5 text-[11px] font-bold text-slate-800">{layout.days[0].label}</span>
              )}
              {layout.ticks.map(tick => (
                <span
                  key={tick.t}
                  className={`absolute top-2.5 -translate-x-1/2 whitespace-nowrap text-[11px] ${tick.isMidnight ? 'font-bold text-slate-800' : 'font-medium text-slate-500'}`}
                  style={{ left: tick.x }}
                >
                  {formatTick(tick)}
                </span>
              ))}
            </div>

            {/* Now marker */}
            {nowX !== null && (
              <div className="absolute top-9 bottom-0 z-10 pointer-events-none" style={{ left: nowX }}>
                <div className="w-px h-full bg-rose-400" />
                <span className="absolute top-1 left-1 text-[10px] font-bold uppercase tracking-wider text-rose-500">Now</span>
              </div>
            )}

            {/* Clusters */}
            {layout.items.map(({ cluster, x, barW, labelSide, lane }) => {
              const styles = TIER_STYLES[tier(cluster.intensity)];
              const isSelected = cluster.id === selectedClusterId;
              const isDimmed = highlightIds && !highlightIds.has(cluster.id);
              const top = 36 + 12 + lane * (ROW_H + ROW_GAP);
              const badge = cluster.articleCount > 1 && (
                <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-bold tabular-nums ${labelSide === 'inside' ? styles.badge : 'bg-slate-100 text-slate-600'}`}>
                  {cluster.articleCount}
                </span>
              );

              return (
                <button
                  key={cluster.id}
                  data-cluster-id={cluster.id}
                  onClick={() => onSelectCluster(cluster.id)}
                  onMouseEnter={e => showTooltip(cluster, e.currentTarget.getBoundingClientRect())}
                  onMouseLeave={() => setTooltip(null)}
                  onFocus={e => showTooltip(cluster, e.currentTarget.getBoundingClientRect())}
                  onBlur={() => setTooltip(null)}
                  aria-label={`${cluster.label}, ${cluster.articleCount} articles`}
                  className={`group absolute flex items-center text-left transition-opacity duration-200 focus:outline-none ${isDimmed ? 'opacity-20 hover:opacity-60' : ''}`}
                  style={{
                    top,
                    height: ROW_H,
                    left: labelSide === 'left' ? undefined : x,
                    right: labelSide === 'left' ? contentWidth - x - barW : undefined,
                    flexDirection: labelSide === 'left' ? 'row-reverse' : 'row',
                  }}
                >
                  <span
                    className={`relative flex h-[26px] items-center gap-2 overflow-hidden rounded-md border px-2.5 shadow-sm transition-shadow group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-indigo-500 group-focus-visible:ring-offset-1 ${styles.bar} ${isSelected ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`}
                    style={{ width: barW }}
                  >
                    {labelSide === 'inside' && (
                      <>
                        <span className="truncate text-xs font-semibold">{cluster.label}</span>
                        <span className="ml-auto">{badge}</span>
                      </>
                    )}
                  </span>
                  {labelSide !== 'inside' && (
                    <span className={`flex items-center gap-1.5 whitespace-nowrap ${labelSide === 'left' ? 'pr-2' : 'pl-2'}`}>
                      <span
                        className={`truncate text-xs font-semibold group-hover:text-indigo-700 ${isSelected ? 'text-slate-950 underline decoration-2 underline-offset-2' : 'text-slate-700'}`}
                        style={{ maxWidth: MAX_LABEL_PX }}
                      >
                        {cluster.label}
                      </span>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {tooltip && (
        <TimelineTooltip {...tooltip} />
      )}

      <footer className="border-t border-slate-200 bg-slate-50 px-5 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500">
        <span className="font-semibold text-slate-600">Coverage</span>
        <LegendSwatch className="bg-indigo-600 border-indigo-700" label="Heavy" />
        <LegendSwatch className="bg-indigo-200 border-indigo-300" label="Moderate" />
        <LegendSwatch className="bg-slate-200 border-slate-300" label="Light" />
        <span className="hidden sm:inline text-slate-400">·</span>
        <span>Bar length = how long the story stayed active</span>
        <span className="ml-auto hidden md:inline text-slate-400">Shift + scroll to pan · click a topic for articles</span>
      </footer>
    </div>
  );
}

function LegendSwatch({ className, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-4 h-2.5 rounded-sm border ${className}`} />
      {label}
    </span>
  );
}

function TimelineTooltip({ cluster, x, top, bottom }) {
  const width = 288;
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const left = Math.min(Math.max(12, x - width / 2), viewportW - width - 12);
  const placeBelow = top < 220;
  const start = new Date(cluster.start).getTime();
  const end = new Date(cluster.end).getTime();

  return (
    <div
      role="tooltip"
      className="fixed z-50 w-72 rounded-xl border border-slate-700 bg-slate-900 p-4 text-xs text-slate-100 shadow-2xl pointer-events-none"
      style={{
        left,
        top: placeBelow ? bottom + 8 : undefined,
        bottom: placeBelow ? undefined : (typeof window !== 'undefined' ? window.innerHeight - top + 8 : undefined),
      }}
    >
      <div className="mb-2 text-sm font-semibold leading-snug">{cluster.label}</div>
      <div className="mb-3 space-y-0.5 border-b border-slate-700/80 pb-3 text-slate-400">
        <div>{formatDateTime(start)}{end !== start && <> → {formatDateTime(end)}</>}</div>
        <div>Active for {formatDuration(end - start)}</div>
      </div>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-slate-300">Articles</span>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 font-bold">{cluster.articleCount}</span>
      </div>
      {cluster.sources?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {cluster.sources.map(s => (
            <span key={s.name} className="flex items-center gap-1.5 rounded-md border border-slate-700/60 bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-300">
              <span className={`h-1.5 w-1.5 rounded-full ${sourceColor(s.name).dot}`} />
              {shortSource(s.name)} <span className="opacity-60">{s.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
