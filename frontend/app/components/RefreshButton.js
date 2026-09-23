"use client";

import { useState, useEffect } from 'react';

export default function RefreshButton({ onRefreshComplete, apiUrl }) {
  const [status, setStatus] = useState('idle'); // idle, triggering, running, error
  const [errorMsg, setErrorMsg] = useState('');
  const [jobId, setJobId] = useState(null);

  useEffect(() => {
    let interval = null;
    let mounted = true;

    const checkStatus = async () => {
      if (!jobId) return;
      try {
        const res = await fetch(`${apiUrl}/ingest/status/${jobId}`);
        if (!res.ok) return; // Keep polling or handle 404
        const data = await res.json();
        
        if (data.status === 'completed') {
          if (mounted) {
            setStatus('success'); // Use intermediate state
            setJobId(null);
            onRefreshComplete();
            setTimeout(() => {
              if (mounted) setStatus('idle');
            }, 2000);
          }
        } else if (data.status === 'failed') {
          if (mounted) {
            setStatus('error');
            setErrorMsg('Pipeline failed');
            setJobId(null);
          }
        }
      } catch (err) {
        console.error('Poll error', err);
      }
    };

    if (jobId) {
      interval = setInterval(checkStatus, 2500);
    }

    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [jobId, apiUrl, onRefreshComplete]);

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
        if (!data.error?.jobId) throw new Error('No jobId returned for running job');
        setJobId(data.error?.jobId);
        return;
      }
      
      if (!res.ok) throw new Error('Failed to trigger ingestion');
      const data = await res.json();
      
      setStatus('running');
      if (!data.jobId) throw new Error('No jobId returned from start');
      setJobId(data.jobId);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMsg('Failed to start');
      setJobId(null);
    }
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
        className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold flex items-center gap-2"
      >
        <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
        ⟳ Refreshing News...
      </button>
    );
  }

  if (status === 'success') {
    return (
      <button 
        disabled
        className="px-4 py-2 bg-emerald-100 text-emerald-800 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
      >
        ✓ Data Updated
      </button>
    );
  }

  return (
    <button 
      onClick={handleRefresh}
      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
    >
      ↻ Refresh Data
    </button>
  );
}
