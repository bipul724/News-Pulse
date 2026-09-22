"use client";

import { useMemo } from 'react';

export default function Timeline({ data, onSelectCluster }) {
  const { minTime, maxTime, span } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    
    data.forEach(item => {
      const start = new Date(item.start).getTime();
      const end = new Date(item.end).getTime();
      if (start < min) min = start;
      if (end > max) max = end;
    });

    // Add 10% padding to span
    const rawSpan = Math.max(max - min, 60000); // at least 1 min
    const padding = rawSpan * 0.1;
    
    return { 
      minTime: min - padding, 
      maxTime: max + padding,
      span: rawSpan + (padding * 2)
    };
  }, [data]);

  const getPositionStyle = (startStr, endStr, intensity) => {
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();
    
    const leftPercent = ((start - minTime) / span) * 100;
    const widthPercent = Math.max(((end - start) / span) * 100, 2); // Minimum 2% width
    
    // Scale height from 30px to 60px based on intensity
    const height = 30 + (intensity * 30);
    
    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
      height: `${height}px`,
      minHeight: '30px'
    };
  };

  return (
    <div className="relative w-full h-96 overflow-y-auto border-l-2 border-slate-200 pl-4 py-8">
      {/* Time axis background indicators could go here */}
      <div className="absolute top-0 bottom-0 left-0 border-l border-dashed border-slate-300 pointer-events-none"></div>

      <div className="relative w-full h-full flex flex-col gap-6">
        {data.map((cluster) => {
          const style = getPositionStyle(cluster.start, cluster.end, cluster.intensity);
          
          return (
            <div 
              key={cluster.id}
              className="relative w-full"
              style={{ minHeight: style.height }}
            >
              <button
                onClick={() => onSelectCluster(cluster.id)}
                className="absolute bg-blue-500 hover:bg-blue-600 text-white rounded-md shadow-md text-left transition-all overflow-hidden flex flex-col justify-center px-3 group"
                style={style}
              >
                <div className="text-xs font-semibold truncate w-full">{cluster.label}</div>
                <div className="text-[10px] opacity-80">{cluster.articleCount} articles</div>
                
                {/* Tooltip on hover for mobile/desktop clarity */}
                <div className="hidden group-hover:block absolute z-10 bg-slate-800 text-white text-xs p-2 rounded -top-8 left-0 shadow-lg whitespace-nowrap">
                  {cluster.label} ({new Date(cluster.start).toLocaleDateString()})
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
