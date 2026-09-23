import { shortSource, sourceColor } from '../lib/format';

export default function SourceFilter({ sources, selectedSources, onToggle, onSelectAll, onSelectOnly }) {
  if (sources.length === 0) return null;

  const allSelected = sources.every(s => selectedSources.has(s.name));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-stone-500">Sources</span>
      <button
        onClick={onSelectAll}
        aria-pressed={allSelected}
        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
          allSelected
            ? 'border-stone-900 bg-stone-900 text-white'
            : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
        }`}
      >
        All
      </button>
      {sources.map(source => {
        const isActive = selectedSources.has(source.name);
        const color = sourceColor(source.name);
        return (
          <span
            key={source.name}
            className={`group flex items-center rounded-full border text-sm font-medium transition-colors ${
              isActive
                ? 'border-stone-300 bg-white text-stone-800 shadow-sm'
                : 'border-dashed border-stone-300 bg-transparent text-stone-400'
            }`}
          >
            <button
              onClick={() => onToggle(source.name)}
              aria-pressed={isActive}
              title={source.name}
              className="flex items-center gap-2 py-1.5 pl-3 pr-2"
            >
              <span className={`h-2 w-2 rounded-full ${isActive ? color.dot : 'bg-stone-300'}`} />
              <span className={isActive ? '' : 'line-through decoration-stone-300'}>{shortSource(source.name)}</span>
              <span className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${isActive ? 'bg-stone-100 text-stone-600' : 'bg-stone-100 text-stone-400'}`}>
                {source.count}
              </span>
            </button>
            <button
              onClick={() => onSelectOnly(source.name)}
              className="mr-1.5 hidden rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-600 hover:bg-accent-50 group-hover:inline focus:inline"
            >
              Only
            </button>
          </span>
        );
      })}
    </div>
  );
}
