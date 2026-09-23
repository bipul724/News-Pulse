import Link from 'next/link';

export function PulseMark() {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-stone-900 text-accent-400">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12h4l2.5-6 5 12 2.5-6h4" />
      </svg>
    </span>
  );
}

export function BrandLink() {
  return (
    <Link href="/" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight text-stone-900">
      <PulseMark />
      News Pulse
    </Link>
  );
}
