"use client";

import React, { useState, useEffect } from 'react';
import { IndeterminateProgressBar } from './progress-bar';

interface GraphOption {
  graphId: string;
  name: string;
  version: number;
}

interface RequestFormProps {
  onRequestCreated: () => void;
}

export function RequestForm({ onRequestCreated }: RequestFormProps) {
  const [title, setTitle] = useState('');
  const [requestType, setRequestType] = useState<'INITIAL' | 'ADD'>('INITIAL');
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  const [rawText, setRawText] = useState('');
  const [targetKgId, setTargetKgId] = useState('');
  const [graphs, setGraphs] = useState<GraphOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [autoRun, setAutoRun] = useState(false);

  // Fetch graphs for ADD request dropdown
  useEffect(() => {
    if (requestType === 'ADD') {
      fetchGraphs();
    }
  }, [requestType]);

  const fetchGraphs = async () => {
    try {
      const res = await fetch('/api/graphs');
      if (res.ok) {
        const data = await res.json();
        setGraphs(data);
        if (data.length > 0 && !targetKgId) {
          setTargetKgId(data[0].graphId);
        }
      }
    } catch (err) {
      console.error('Error fetching graphs:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.txt')) {
      setError('Only .txt files are supported.');
      e.target.value = '';
      setRawText('');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawText(text);
      setError(null);
    };
    reader.onerror = () => {
      setError('Failed to read file.');
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    if (!title.trim()) {
      setError('Title is required.');
      setIsLoading(false);
      return;
    }

    if (!rawText.trim()) {
      setError('Raw text content is required.');
      setIsLoading(false);
      return;
    }

    if (requestType === 'ADD' && !targetKgId) {
      setError('Please select a target Knowledge Graph.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          requestType,
          rawText: rawText.trim(),
          targetKgId: requestType === 'ADD' ? targetKgId : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit request.');
      }

      setSuccess(true);
      setAutoRun(data.autoStarted);
      setTitle('');
      setRawText('');
      // Reset file input if present
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Auto dismiss success banner
      setTimeout(() => setSuccess(false), 6000);

      onRequestCreated();
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs max-w-7xl w-full">
      <h2 className="text-md font-bold text-zinc-950 border-b border-zinc-300 pb-3.5 mb-5 flex items-center gap-2">
        <svg className="w-5 h-5 text-zinc-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        New Processing Request
      </h2>

      {error && (
        <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 rounded-lg flex items-start gap-2">
          <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 01-2 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-250 text-xs font-semibold text-emerald-800 rounded-lg flex items-start gap-2">
          <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div>
            Request submitted successfully! {autoRun
              ? "No other tasks are running, so the Python pipeline has started automatically."
              : "Another process is running; this request is placed in the queue. You can run it manually when the active process finishes."}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="mb-4">
          <IndeterminateProgressBar label="Submitting request pipeline..." />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Title */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
              Title / Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., movie-kg"
              className="w-full text-sm border border-zinc-200 rounded-lg px-3.5 py-2.5 text-zinc-900 bg-white placeholder-zinc-400 focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition font-sans shadow-xs"
              required
            />
          </div>

          {/* Request Type */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
              Request Type
            </label>
            <div className="relative">
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as 'INITIAL' | 'ADD')}
                className="w-full text-sm border border-zinc-200 rounded-lg px-3.5 py-2.5 text-zinc-900 bg-white focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition font-sans appearance-none cursor-pointer pr-10 shadow-xs"
                style={{ fontFamily: 'inherit' }}
              >
                <option value="INITIAL">INITIAL (Generate New Graph)</option>
                <option value="ADD">ADD (Incremental Update)</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-zinc-400">
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Target Graph Selector (ADD only) */}
        {requestType === 'ADD' && (
          <div className="bg-zinc-50/75 border border-zinc-200 rounded-xl p-4">
            <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
              Target Knowledge Graph
            </label>
            {graphs.length > 0 ? (
              <div className="relative">
                <select
                  value={targetKgId}
                  onChange={(e) => setTargetKgId(e.target.value)}
                  className="w-full text-sm border border-zinc-200 rounded-lg px-3.5 py-2.5 text-zinc-900 bg-white focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition font-sans appearance-none cursor-pointer pr-10 shadow-xs"
                  style={{ fontFamily: 'inherit' }}
                >
                  {graphs.map((g) => (
                    <option key={g.graphId} value={g.graphId}>
                      {g.name} (v{g.version})
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-zinc-400">
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            ) : (
              <span className="text-xs text-zinc-500 font-medium italic block bg-white border border-zinc-200 rounded-lg p-3 text-center">
                No completed graphs available in database. Please run an INITIAL request first.
              </span>
            )}
          </div>
        )}

        {/* Input Mode Selector */}
        <div>
          <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
            Input Method
          </label>
          <div className="flex items-center gap-6">
            <label className="inline-flex items-center text-sm font-semibold text-zinc-700 cursor-pointer">
              <input
                type="radio"
                name="inputMode"
                value="text"
                checked={inputMode === 'text'}
                onChange={() => { setInputMode('text'); setRawText(''); }}
                className="mr-2 h-4.5 w-4.5 border-zinc-300 text-zinc-900 focus:ring-zinc-950 accent-zinc-900"
              />
              Type Text
            </label>
            <label className="inline-flex items-center text-sm font-semibold text-zinc-700 cursor-pointer">
              <input
                type="radio"
                name="inputMode"
                value="file"
                checked={inputMode === 'file'}
                onChange={() => { setInputMode('file'); setRawText(''); }}
                className="mr-2 h-4.5 w-4.5 border-zinc-300 text-zinc-900 focus:ring-zinc-950 accent-zinc-900"
              />
              Upload .txt File
            </label>
          </div>
        </div>

        {/* Raw Text Input Area */}
        {inputMode === 'text' ? (
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
              Source Text Content
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste or type raw source text here to build the knowledge graph..."
              rows={6}
              className="w-full text-sm border border-zinc-200 rounded-lg px-3.5 py-2.5 text-zinc-900 bg-white placeholder-zinc-400 focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition font-sans leading-relaxed shadow-xs"
              required
            />
          </div>
        ) : (
          <div className="border border-dashed border-zinc-300 hover:border-zinc-400 rounded-xl p-6 bg-zinc-50/50 flex flex-col items-center justify-center transition">
            <input
              type="file"
              id="file-input"
              accept=".txt"
              onChange={handleFileChange}
              className="hidden"
              required={inputMode === 'file'}
            />
            <label
              htmlFor="file-input"
              className="cursor-pointer bg-white border border-zinc-300 hover:border-zinc-400 text-zinc-800 text-xs font-bold px-5 py-2.5 rounded-full shadow-xs hover:shadow-sm transition"
            >
              Choose .txt File
            </label>
            <span className="text-[10px] font-semibold text-zinc-400 mt-2 uppercase tracking-wide">
              Only UTF-8 encoded text files (.txt)
            </span>
            {rawText && (
              <div className="mt-4 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3.5 py-2 rounded-full border border-emerald-200 flex items-center gap-1.5">
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Loaded: {rawText.split(/\s+/).filter(Boolean).length} words ready
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading || (requestType === 'ADD' && graphs.length === 0)}
            className="w-full md:w-auto bg-zinc-950 hover:bg-zinc-850 disabled:bg-zinc-200 text-white font-bold text-xs px-6 py-3 rounded-full shadow-sm hover:shadow transition cursor-pointer"
          >
            {isLoading ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </div>
  );
}
