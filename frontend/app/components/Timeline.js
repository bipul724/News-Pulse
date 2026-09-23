"use client";

import { useMemo, useState } from 'react';

export default function Timeline({ data, onSelectCluster, selectedClusterId }) {
  const [hoveredClusterId, setHoveredClusterId] = useState(null);

  const { minTime, maxTime, span, lanes, ticks, stats } = useMemo(() => {
    if (!data || data.length === 0) return { minTime: 0, maxTime: 0, span: 1, lanes: [], ticks: [], stats: { clusters: 0, articles: 0 } };

    let min = Infinity;
    let max = -Infinity;
    let totalArticles = 0;
    
    data.forEach(item => {
      const start = new Date(item.start).getTime();
      const end = new Date(item.end).getTime();
      if (start < min) min = start;
      if (end > max) max = end;
      totalArticles += item.articleCount;
    });

    const rawSpan = Math.max(max - min, 60000);
    const padding = rawSpan * 0.05; // 5% padding on each side
    const finalMin = min - padding;
    const finalMax = max + padding;
    const finalSpan = finalMax - finalMin;

    // Generate axis ticks
    const numTicks = 6;
    const generatedTicks = [];
    for (let i = 0; i < numTicks; i++) {
      generatedTicks.push(finalMin + (finalSpan * (i / (numTicks - 1))));
    }

    // Packing clusters into lanes
    const sortedData = [...data].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const laneEnds = [];
    const packedLanes = [];

    sortedData.forEach(cluster => {
      const start = new Date(cluster.start).getTime();
      const end = new Date(cluster.end).getTime();
      
      let assignedLane = 0;
      // Find first lane that ends before this cluster starts
      while (laneEnds[assignedLane] && laneEnds[assignedLane] > start) {
        assignedLane++;
      }
      
      // Pad the end time so clusters don't touch horizontally
      laneEnds[assignedLane] = end + (finalSpan * 0.04);
      
      if (!packedLanes[assignedLane]) packedLanes[assignedLane] = [];
      packedLanes[assignedLane].push({ ...cluster });
    });

    return { 
      minTime: finalMin, 
      maxTime: finalMax,
      span: finalSpan,
      lanes: packedLanes,
      ticks: generatedTicks,
      stats: { clusters: data.length, articles: totalArticles }
    };
  }, [data]);

  const getPositionStyle = (startStr, endStr) => {
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();
    
    const leftPercent = ((start - minTime) / span) * 100;
    const widthPercent = ((end - start) / span) * 100;
    
    return {
      left: `${leftPercent}%`,
      width: `max(60px, ${widthPercent}%)`,
    };
  };

  const formatDate = (timestamp) => {
    const d = new Date(timestamp);
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const formatTick = (timestamp) => {
    const d = new Date(timestamp);
    if (span > 86400000 * 2) { // more than 2 days
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!data || data.length === 0) return null;

  const hoveredCluster = data.find(c => c.id === hoveredClusterId);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
      {/* Header */}
      <header className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white z-20 shrink-0">
        <div>
          <h2 className="text-base font-semibold text-slate-800 tracking-tight">Timeline</h2>
          <p className="text-xs text-slate-500 mt-0.5">Topic activity across the latest news cycle</p>
        </div>
        <div className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
          {stats.clusters} clusters &middot; {stats.articles} articles
        </div>
      </header>

      {/* Timeline Surface */}
      <div className="relative flex-1 flex flex-col bg-slate-50/30 overflow-x-auto custom-scrollbar">
        <div className="min-w-[800px] h-full flex flex-col relative">
          
          {/* Time Axis */}
          <div className="sticky top-0 h-8 border-b border-slate-200 bg-white/90 backdrop-blur z-10 flex items-end">
            {ticks.map((tick, i) => (
              <div key={i} className="absolute flex flex-col items-center transform -translate-x-1/2" style={{ left: `${((tick - minTime) / span) * 100}%` }}>
                <span className="text-[10px] font-semibold text-slate-500 mb-1 tracking-wider">{formatTick(tick)}</span>
                <div className="w-px h-1.5 bg-slate-300"></div>
              </div>
            ))}
          </div>

          {/* Vertical Grid Lines */}
          <div className="absolute top-8 bottom-0 left-0 right-0 pointer-events-none">
            {ticks.map((tick, i) => (
              <div key={i} className="absolute top-0 bottom-0 w-px bg-slate-200/60" style={{ left: `${((tick - minTime) / span) * 100}%` }}></div>
            ))}
          </div>

          {/* Lanes */}
          <div className="relative flex-1 py-4 flex flex-col gap-2 z-0 overflow-y-auto custom-scrollbar px-2 pr-20">
            {lanes.map((laneClusters, laneIdx) => (
              <div key={laneIdx} className="relative h-10 w-full shrink-0">
                {laneClusters.map(cluster => {
                  const style = getPositionStyle(cluster.start, cluster.end);
                  const isSelected = cluster.id === selectedClusterId;
                  
                  // Intensity styling
                  const intensityVal = cluster.intensity || 0;
                  const isHighIntensity = intensityVal > 0.6;
                  const isMedIntensity = intensityVal > 0.3 && intensityVal <= 0.6;
                  
                  let blockClass = 'bg-white border-slate-300 text-slate-700 hover:border-slate-400 hover:shadow-sm';
                  let heightClass = 'h-8';
                  let indicatorColor = 'bg-slate-300';
                  
                  if (isSelected) {
                    blockClass = 'bg-slate-800 border-slate-800 text-white shadow-md ring-2 ring-slate-800/20';
                    indicatorColor = 'bg-white/30';
                  } else if (isHighIntensity) {
                    blockClass = 'bg-indigo-50 border-indigo-200 text-indigo-900 hover:border-indigo-300 hover:shadow-sm';
                    heightClass = 'h-9';
                    indicatorColor = 'bg-indigo-400';
                  } else if (isMedIntensity) {
                    blockClass = 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 hover:shadow-sm';
                    indicatorColor = 'bg-slate-400';
                  }
                  
                  return (
                    <div 
                      key={cluster.id}
                      className="absolute top-1/2 transform -translate-y-1/2 pr-2"
                      style={{ left: style.left, width: style.width }}
                      onMouseEnter={() => setHoveredClusterId(cluster.id)}
                      onMouseLeave={() => setHoveredClusterId(null)}
                    >
                      <button
                        onClick={() => onSelectCluster(cluster.id)}
                        className={`w-full rounded-md border text-left overflow-hidden transition-all flex flex-col justify-center px-2.5 relative ${heightClass} ${blockClass}`}
                      >
                        {/* Intensity left-border indicator */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${indicatorColor}`}></div>
                        
                        <div className="flex items-center justify-between gap-2 pl-1">
                          <span className="text-[11px] font-semibold truncate leading-tight">{cluster.label}</span>
                          {cluster.articleCount > 1 && (
                            <span className={`text-[9px] font-medium shrink-0 px-1 rounded ${isSelected ? 'bg-white/20' : 'bg-slate-200/50'}`}>
                              {cluster.articleCount}
                            </span>
                          )}
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fixed Tooltip Overlay (prevents clipping issues) */}
      {hoveredCluster && (
        <div className="absolute bottom-4 left-4 z-50 bg-slate-900 text-slate-100 text-xs rounded-xl shadow-2xl p-4 w-72 pointer-events-none border border-slate-700 animate-in fade-in zoom-in duration-150">
          <div className="font-bold mb-1 text-sm leading-snug">{hoveredCluster.label}</div>
          <div className="text-slate-400 mb-3 border-b border-slate-700/80 pb-3 flex flex-col gap-1">
            <span>{formatDate(hoveredCluster.start)}</span>
            {hoveredCluster.start !== hoveredCluster.end && (
              <span>→ {formatDate(hoveredCluster.end)}</span>
            )}
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-slate-300">Total Articles</span>
            <span className="bg-slate-800 px-2 py-0.5 rounded-full font-bold">{hoveredCluster.articleCount}</span>
          </div>
          {hoveredCluster.sources && hoveredCluster.sources.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {hoveredCluster.sources.map(s => (
                <span key={s.name} className="text-[10px] bg-slate-800 px-2 py-1 rounded-md text-slate-300 font-medium border border-slate-700/50">
                  {s.name} <span className="opacity-50 ml-0.5">{s.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contextual Legend */}
      <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 text-[10px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-indigo-50 border border-indigo-200 rounded"></div>
            <span>High activity</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-white border border-slate-300 rounded"></div>
            <span>Standard</span>
          </div>
          <span>Block width = topic duration</span>
        </div>
      </div>
    </div>
  );
}
