"use client";

import { useEffect, useState } from 'react';

export default function ClusterDrawer({ clusterId, onClose, apiUrl }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const fetchCluster = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${apiUrl}/clusters/${clusterId}`);
        if (!res.ok) throw new Error('Failed to fetch cluster details');
        const json = await res.json();
        if (active) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError('Unable to load articles.');
          console.error(err);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    
    if (clusterId) {
      fetchCluster();
    }
    return () => { active = false; };
  }, [clusterId, apiUrl]);

  return (
    <>
      <div 
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed top-0 right-0 h-full w-full md:w-[480px] bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-out border-l border-slate-200">
        <header className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-4 flex justify-between items-start z-10">
          <div className="flex-1 pr-4">
            <h2 className="text-xl font-bold text-slate-900 leading-tight mb-1">
              {data?.cluster?.label || (loading ? 'Loading cluster...' : 'Cluster Details')}
            </h2>
            {data && !loading && (
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {data.cluster.articleCount} Articles &middot; {new Date(data.cluster.start).toLocaleDateString()}
              </p>
            )}
          </div>
          <button 
            onClick={onClose}
            aria-label="Close"
            className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            ✕
          </button>
        </header>

        <div className="p-6 flex-1 overflow-y-auto bg-slate-50">
          {loading && (
            <div className="flex flex-col gap-4 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="w-16 h-4 bg-slate-100 rounded mb-3"></div>
                  <div className="w-full h-5 bg-slate-100 rounded mb-2"></div>
                  <div className="w-3/4 h-5 bg-slate-100 rounded mb-4"></div>
                  <div className="w-24 h-4 bg-slate-100 rounded"></div>
                </div>
              ))}
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-sm font-medium">
              {error}
            </div>
          )}
          
          {data && !loading && (
            <div className="flex flex-col gap-4">
              {data.articles.map(article => (
                <article key={article.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-sm transition-all group">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider bg-slate-100 px-2 py-1 rounded">
                      {article.source}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2 leading-snug group-hover:text-blue-700 transition-colors">
                    {article.headline}
                  </h3>
                  <div className="flex justify-between items-end mt-4">
                    <span className="text-xs text-slate-500">
                      {new Date(article.publishedAt).toLocaleDateString()} &middot; {new Date(article.publishedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                    <a 
                      href={article.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      Read article <span aria-hidden="true">&rarr;</span>
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
