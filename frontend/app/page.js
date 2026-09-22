"use client";

import { useState, useEffect } from 'react';
import Timeline from './components/Timeline';
import SourceFilter from './components/SourceFilter';
import ClusterDrawer from './components/ClusterDrawer';
import RefreshButton from './components/RefreshButton';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function Home() {
  const [timelineData, setTimelineData] = useState([]);
  const [sources, setSources] = useState([]);
  const [selectedSources, setSelectedSources] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedClusterId, setSelectedClusterId] = useState(null);

  const fetchTimeline = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/timeline`);
      if (!res.ok) throw new Error('Failed to fetch timeline');
      const data = await res.json();
      
      setTimelineData(data.timeline || []);
      
      // Extract unique sources from all timeline items
      const allSources = new Set();
      data.timeline?.forEach(item => {
        item.sources?.forEach(s => allSources.add(s.name));
      });
      
      const sourceList = Array.from(allSources);
      setSources(sourceList);
      
      // Initially select all if empty
      if (selectedSources.size === 0) {
        setSelectedSources(new Set(sourceList));
      }
      
      setError(null);
    } catch (err) {
      setError('Unable to load news data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, []);

  const toggleSource = (sourceName) => {
    const newSelection = new Set(selectedSources);
    if (newSelection.has(sourceName)) {
      newSelection.delete(sourceName);
    } else {
      newSelection.add(sourceName);
    }
    setSelectedSources(newSelection);
  };

  // Filter timeline based on sources
  const filteredTimeline = timelineData.filter(item => {
    if (!item.sources || item.sources.length === 0) return true; // Show items with no source data if any
    return item.sources.some(s => selectedSources.has(s.name));
  });

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto flex flex-col gap-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4 border-slate-200">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">News Pulse</h1>
          <p className="text-slate-500">Topic-clustered news timeline</p>
        </div>
        <RefreshButton onRefreshComplete={fetchTimeline} apiUrl={API_URL} />
      </header>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md border border-red-200">
          {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 shrink-0">
          <SourceFilter 
            sources={sources} 
            selectedSources={selectedSources} 
            onToggle={toggleSource} 
          />
        </aside>
        
        <section className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold mb-6">Timeline</h2>
          
          {loading ? (
            <div className="text-slate-500 flex items-center justify-center h-48">
              Loading news timeline...
            </div>
          ) : timelineData.length === 0 ? (
            <div className="text-slate-500 flex items-center justify-center h-48">
              No clusters yet. Click Refresh Data to run the pipeline.
            </div>
          ) : filteredTimeline.length === 0 ? (
            <div className="text-slate-500 flex items-center justify-center h-48">
              No clusters match the selected sources.
            </div>
          ) : (
            <Timeline 
              data={filteredTimeline} 
              onSelectCluster={setSelectedClusterId} 
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
