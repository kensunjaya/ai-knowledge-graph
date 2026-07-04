"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { RequestForm } from '@/components/request-form';
import { RequestTable, RequestItem } from '@/components/request-table';

export default function Home() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Set up polling: poll every 3 seconds when there are active jobs (PENDING or PROCESSING)
  useEffect(() => {
    const hasActiveJobs = requests.some(
      (r) => r.status === 'PENDING' || r.status === 'PROCESSING'
    );

    if (!hasActiveJobs) return;

    const interval = setInterval(() => {
      fetchRequests();
    }, 3000);

    return () => clearInterval(interval);
  }, [requests, fetchRequests]);

  return (
    <div className="min-h-screen bg-white font-sans text-zinc-900 pb-20">
      <header className="bg-white border-b border-zinc-200 py-4.5 px-6 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-900"></div>
            <h1 className="text-md font-bold tracking-tight text-zinc-950">
              Knowledge Graph Automation
            </h1>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-100/75 border border-zinc-200/50 px-2 py-0.5 rounded">
            Admin Console
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 space-y-8 flex flex-col items-center">
        {/* Form component */}
        <RequestForm onRequestCreated={fetchRequests} />

        {/* Requests monitor list */}
        {isLoading ? (
          <div className="text-center py-16 text-zinc-450 italic text-sm font-medium">
            Loading database records...
          </div>
        ) : (
          <RequestTable requests={requests} setRequests={setRequests} onActionTriggered={fetchRequests} />
        )}
      </main>
    </div>
  );
}
