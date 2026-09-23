const SOURCE_PALETTE = [
  // Muted ink tones, kept away from the vermilion accent so it stays meaningful.
  { dot: 'bg-[#3d6a8a]', text: 'text-[#2f5570]', soft: 'bg-[#e8eff4]', hex: '#3d6a8a' },
  { dot: 'bg-[#b7862b]', text: 'text-[#87621c]', soft: 'bg-[#f6eedd]', hex: '#b7862b' },
  { dot: 'bg-[#5b7f5a]', text: 'text-[#43613f]', soft: 'bg-[#e9f0e6]', hex: '#5b7f5a' },
  { dot: 'bg-[#7d4e6e]', text: 'text-[#603b54]', soft: 'bg-[#f2e8ef]', hex: '#7d4e6e' },
  { dot: 'bg-[#3f7a78]', text: 'text-[#2e5d5b]', soft: 'bg-[#e4f0ef]', hex: '#3f7a78' },
  { dot: 'bg-[#57534e]', text: 'text-[#44403c]', soft: 'bg-[#efedea]', hex: '#57534e' },
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

// Coverage tiers shared by the timeline and the landing page preview.
export function coverageTier(intensity = 0) {
  if (intensity > 0.6) return 'high';
  if (intensity > 0.3) return 'medium';
  return 'low';
}

export const TIER_STYLES = {
  high: { bar: 'bg-accent-600 border-accent-700 text-white', badge: 'bg-white/20 text-white' },
  medium: { bar: 'bg-accent-200 border-accent-300 text-accent-950', badge: 'bg-accent-950/10 text-accent-900' },
  low: { bar: 'bg-stone-200 border-stone-300 text-stone-800', badge: 'bg-stone-900/10 text-stone-700' },
};
