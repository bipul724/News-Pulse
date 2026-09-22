"use client";

import { useEffect, useState } from 'react';

export default function ClusterDrawer({ clusterId, onClose, apiUrl }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCluster = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${apiUrl}/clusters/${clusterId}`);
        if (!res.ok) throw new Error('Failed to fetch cluster details');
        const json = await res.json();
        setData(json);
        setError(null);
      } catch (err) {
        setError('Unable to load articles.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    if (clusterId) {
      fetchCluster();
    }
  }, [clusterId, apiUrl]);

  return (
    <>
      <div 
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      
      <div className="fixed top-0 right-0 h-full w-full md:w-[500px] bg-white shadow-2xl z-50 overflow-y-auto flex flex-col transform transition-transform duration-300">
        <header className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10">
          <h2 className="text-lg font-bold text-slate-800 line-clamp-1 flex-1 pr-4">
            {data?.cluster?.label || 'Loading...'}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
          >
            ✕
          </button>
        </header>

        <div className="p-6 flex-1">
          {loading && (
            <div className="text-slate-500 flex justify-center py-12">Loading articles...</div>
          )}
          
          {error && (
            <div className="text-red-500 py-4">{error}</div>
          )}
          
          {data && !loading && (
            <div className="flex flex-col gap-6">
              <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600 flex justify-between items-center border border-slate-100">
                <div>
                  <span className="font-semibold">{data.cluster.articleCount}</span> related articles
                </div>
                <div className="text-xs">
                  {new Date(data.cluster.start).toLocaleDateString()}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {data.articles.map(article => (
                  <article key={article.id} className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                    <div className="flex justify-between items-start mb-2 gap-4">
                      <span className="text-xs font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-1 rounded">
                        {article.source}
                      </span>
                      <span className="text-xs text-slate-500 whitespace-nowrap">
                        {new Date(article.publishedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-800 mb-3 leading-snug">
                      {article.headline}
                    </h3>
                    <a 
                      href={article.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      Read full article ↗
                    </a>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
