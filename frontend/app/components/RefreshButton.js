"use client";

import { useState } from 'react';

export default function RefreshButton({ onRefreshComplete, apiUrl }) {
  const [status, setStatus] = useState('idle'); // idle, triggering, running, error
  const [errorMsg, setErrorMsg] = useState('');

  const handleRefresh = async () => {
    try {
      setStatus('triggering');
      setErrorMsg('');

      const res = await fetch(`${apiUrl}/ingest/trigger`, {
        method: 'POST',
      });
      
      if (res.status === 409) {
        setStatus('running'); // Already running, join the poll
        const data = await res.json();
        pollStatus(data.error?.jobId);
        return;
      }
      
      if (!res.ok) throw new Error('Failed to trigger ingestion');
      const data = await res.json();
      
      setStatus('running');
      pollStatus(data.jobId);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMsg('Failed to start');
    }
  };

  const pollStatus = async (jobId) => {
    if (!jobId) {
        setStatus('error');
        return;
    }
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${apiUrl}/ingest/status/${jobId}`);
        if (!res.ok) return; // Keep polling or handle 404
        const data = await res.json();
        
        if (data.status === 'completed') {
          clearInterval(interval);
          setStatus('idle');
          onRefreshComplete();
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setStatus('error');
          setErrorMsg('Pipeline failed');
        }
      } catch (err) {
        console.error('Poll error', err);
      }
    }, 2500);
  };

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-red-500 text-sm font-medium">{errorMsg}</span>
        <button 
          onClick={handleRefresh}
          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-sm font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (status === 'triggering' || status === 'running') {
    return (
      <button 
        disabled
        className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium flex items-center gap-2"
      >
        <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
        {status === 'triggering' ? 'Starting...' : 'Fetching latest news...'}
      </button>
    );
  }

  return (
    <button 
      onClick={handleRefresh}
      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
    >
      Refresh Data
    </button>
  );
}
