const SOURCE_PALETTE = [
  { dot: 'bg-sky-500', text: 'text-sky-700', soft: 'bg-sky-50', hex: '#0ea5e9' },
  { dot: 'bg-rose-500', text: 'text-rose-700', soft: 'bg-rose-50', hex: '#f43f5e' },
  { dot: 'bg-amber-500', text: 'text-amber-700', soft: 'bg-amber-50', hex: '#f59e0b' },
  { dot: 'bg-emerald-500', text: 'text-emerald-700', soft: 'bg-emerald-50', hex: '#10b981' },
  { dot: 'bg-violet-500', text: 'text-violet-700', soft: 'bg-violet-50', hex: '#8b5cf6' },
  { dot: 'bg-teal-500', text: 'text-teal-700', soft: 'bg-teal-50', hex: '#14b8a6' },
];

const assigned = new Map();

// Give each known source its own palette slot (alphabetical, so it is stable across reloads).
export function registerSources(names) {
  [...names].sort().forEach(name => {
    if (!assigned.has(name)) assigned.set(name, SOURCE_PALETTE[assigned.size % SOURCE_PALETTE.length]);
  });
}

export function sourceColor(name = '') {
  if (assigned.has(name)) return assigned.get(name);
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return SOURCE_PALETTE[hash % SOURCE_PALETTE.length];
}

// Feed titles like "NYT > World News" or "NPR Topics: World" read better trimmed.
export function shortSource(name = '') {
  return name.split(/\s*[>:]\s*/)[0] || name;
}

export function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(ts) {
  const d = new Date(ts);
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${formatTime(d)}`;
}

export function formatDuration(ms) {
  if (ms < 60000) return 'single moment';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const hours = ms / 3600000;
  if (hours < 48) return `${hours < 10 ? hours.toFixed(1).replace(/\.0$/, '') : Math.round(hours)} h`;
  return `${Math.round(hours / 24)} days`;
}

export function timeAgo(ts, now = Date.now()) {
  const diff = Math.max(0, now - new Date(ts).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
