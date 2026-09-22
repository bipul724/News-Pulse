export default function SourceFilter({ sources, selectedSources, onToggle }) {
  if (sources.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-700 mb-3">Sources</h3>
      <div className="flex flex-col gap-2">
        {sources.map(source => (
          <label key={source} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
            <input 
              type="checkbox" 
              checked={selectedSources.has(source)}
              onChange={() => onToggle(source)}
              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <span className="text-sm text-slate-700">{source}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
