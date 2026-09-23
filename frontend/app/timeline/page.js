"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Timeline from '../components/Timeline';
import SourceFilter from '../components/SourceFilter';
import ClusterDrawer from '../components/ClusterDrawer';
import RefreshButton from '../components/RefreshButton';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export default function Home() {
  const [timelineData, setTimelineData] = useState([]);
  const [sources, setSources] = useState([]);
  const [selectedSources, setSelectedSources] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedClusterId, setSelectedClusterId] = useState(null);

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/timeline`);
      if (!res.ok) throw new Error('Failed to fetch timeline');
      const data = await res.json();
      
      setTimelineData(data.timeline || []);
      
      // Extract unique sources and their total article counts
      const sourceMap = new Map();
      data.timeline?.forEach(item => {
        item.sources?.forEach(s => {
          sourceMap.set(s.name, (sourceMap.get(s.name) || 0) + s.count);
        });
      });
      
      const sourceList = Array.from(sourceMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
        
      setSources(sourceList);
      
      // Initially select all if empty
      setSelectedSources(prev => {
        if (prev.size === 0) {
          return new Set(sourceList.map(s => s.name));
        }
        return prev;
      });
      
      setError(null);
    } catch (err) {
      setError('Unable to load the timeline. Check that the News Pulse API is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (active) await fetchTimeline();
    };
    run();
    return () => { active = false; };
  }, [fetchTimeline]);

  const toggleSource = (sourceName) => {
    const newSelection = new Set(selectedSources);
    if (newSelection.has(sourceName)) {
      newSelection.delete(sourceName);
    } else {
      newSelection.add(sourceName);
    }
    setSelectedSources(newSelection);
  };

  const filteredTimeline = timelineData.filter(item => {
    if (!item.sources || item.sources.length === 0) return true;
    return item.sources.some(s => selectedSources.has(s.name));
  });

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 flex flex-col gap-6">
        
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-slate-200 pb-6 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 hover:text-indigo-600 transition-colors">News Pulse</h1>
              </Link>
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> LIVE
              </span>
            </div>
            <p className="text-slate-500 text-sm">Topic-clustered news intelligence</p>
          </div>
          <RefreshButton onRefreshComplete={fetchTimeline} apiUrl={API_URL} />
        </header>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={fetchTimeline} className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-sm font-medium transition-colors">
              Try Again
            </button>
          </div>
        )}

        <SourceFilter 
          sources={sources} 
          selectedSources={selectedSources} 
          onToggle={toggleSource} 
        />
        
        <section className="flex-1 min-h-[500px] flex flex-col">
          {loading ? (
            <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
              <header className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white z-20 shrink-0">
                <div>
                  <h2 className="text-base font-semibold text-slate-800 tracking-tight">Timeline</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Topic activity across the latest news cycle</p>
                </div>
              </header>
              <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-6">
                <div className="w-full max-w-2xl animate-pulse space-y-4">
                  <div className="h-6 bg-slate-100 rounded w-full"></div>
                  <div className="h-8 bg-slate-100 rounded w-3/4 ml-auto"></div>
                  <div className="h-8 bg-slate-100 rounded w-1/2"></div>
                  <div className="h-6 bg-slate-100 rounded w-2/3 ml-12"></div>
                </div>
              </div>
            </div>
          ) : timelineData.length === 0 ? (
            <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
              <header className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white z-20 shrink-0">
                <div>
                  <h2 className="text-base font-semibold text-slate-800 tracking-tight">Timeline</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Topic activity across the latest news cycle</p>
                </div>
              </header>
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50">
                <h3 className="text-lg font-semibold text-slate-700 mb-2">No news activity yet</h3>
                <p className="text-slate-500 max-w-sm mb-6 text-sm">Run Refresh Data to fetch the latest stories and build the timeline.</p>
                <RefreshButton onRefreshComplete={fetchTimeline} apiUrl={API_URL} />
              </div>
            </div>
          ) : filteredTimeline.length === 0 ? (
            <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
              <header className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white z-20 shrink-0">
                <div>
                  <h2 className="text-base font-semibold text-slate-800 tracking-tight">Timeline</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Topic activity across the latest news cycle</p>
                </div>
              </header>
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500 bg-slate-50 text-sm">
                No clusters match the selected sources.
              </div>
            </div>
          ) : (
            <Timeline 
              data={filteredTimeline} 
              onSelectCluster={setSelectedClusterId} 
              selectedClusterId={selectedClusterId}
            />
          )}
        </section>
      </div>

      {selectedClusterId && (
        <ClusterDrawer 
          clusterId={selectedClusterId} 
          onClose={() => setSelectedClusterId(null)} 
          apiUrl={API_URL}
        />
      )}
    </main>
  );
}
