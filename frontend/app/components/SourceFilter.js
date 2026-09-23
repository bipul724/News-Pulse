export default function SourceFilter({ sources, selectedSources, onToggle }) {
  if (sources.length === 0) return null;

  const allSelected = sources.every(s => selectedSources.has(s.name));

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Sources</span>
      <div className="flex flex-wrap gap-2">
        {sources.map(source => {
          const isActive = selectedSources.has(source.name);
          return (
            <button
              key={source.name}
              onClick={() => onToggle(source.name)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                isActive 
                  ? 'bg-slate-800 border-slate-800 text-white shadow-sm' 
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span>{source.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-slate-700' : 'bg-slate-100 text-slate-500'}`}>
                {source.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
