import { formatDateTime, formatDuration, shortSource, sourceColor, timeAgo } from '../lib/format';

export default function ClusterList({ data, onSelectCluster, selectedClusterId, now }) {
  const maxCount = Math.max(...data.map(c => c.articleCount), 1);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {data.map((cluster, idx) => {
        const start = new Date(cluster.start).getTime();
        const end = new Date(cluster.end).getTime();
        const isSelected = cluster.id === selectedClusterId;
        return (
          <button
            key={cluster.id}
            onClick={() => onSelectCluster(cluster.id)}
            className={`group flex flex-col rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
              isSelected ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500">
              <span className="tabular-nums">#{idx + 1} · updated {timeAgo(end, now)}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-700 tabular-nums">
                {cluster.articleCount} {cluster.articleCount === 1 ? 'article' : 'articles'}
              </span>
            </div>
            <h3 className="mb-3 line-clamp-3 font-semibold leading-snug text-slate-900 group-hover:text-indigo-700">
              {cluster.label}
            </h3>
            <div className="mt-auto space-y-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(cluster.articleCount / maxCount) * 100}%` }} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {cluster.sources?.map(s => (
                    <span key={s.name} className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${sourceColor(s.name).soft} ${sourceColor(s.name).text}`}>
                      {shortSource(s.name)} {s.count > 1 && <span className="opacity-60">{s.count}</span>}
                    </span>
                  ))}
                </div>
                <span className="text-[11px] text-slate-400" title={`${formatDateTime(start)} → ${formatDateTime(end)}`}>
                  {end > start ? `over ${formatDuration(end - start)}` : formatDateTime(start)}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
