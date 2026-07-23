"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { IndeterminateProgressBar } from './progress-bar';

export interface RequestItem {
  requestId: string;
  title: string;
  requestType: 'INITIAL' | 'ADD';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  resultId: string | null;
  graphId: string | null;
  version: number | null;
}

interface RequestTableProps {
  requests: RequestItem[];
  setRequests: React.Dispatch<React.SetStateAction<RequestItem[]>>;
  onActionTriggered: () => void;
}

export function RequestTable({ requests, setRequests, onActionTriggered }: RequestTableProps) {
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [modalRequest, setModalRequest] = useState<RequestItem | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Sort states
  const [sortField, setSortField] = useState<'title' | 'requestType' | 'status' | 'createdAt'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Determine if any job is currently PROCESSING
  const isAnyProcessing = requests.some((r) => r.status === 'PROCESSING');

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const handleRun = async (requestId: string) => {
    // Optimistic UI update: immediately show status as PROCESSING locally
    setRequests((prev) =>
      prev.map((r) => (r.requestId === requestId ? { ...r, status: 'PROCESSING' } : r))
    );
    setActionLoadingId(requestId);
    try {
      const res = await fetch(`/api/requests/${requestId}/run`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        console.error(data.error || 'Failed to run process.');
        onActionTriggered(); // revert/refetch
      } else {
        onActionTriggered();
      }
    } catch (err) {
      console.error(err);
      onActionTriggered(); // revert/refetch
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRetry = async (requestId: string) => {
    // Optimistic UI update: immediately show status as PROCESSING locally
    setRequests((prev) =>
      prev.map((r) =>
        r.requestId === requestId ? { ...r, status: 'PROCESSING', errorMessage: null } : r
      )
    );
    setActionLoadingId(requestId);
    try {
      const res = await fetch(`/api/requests/${requestId}/retry`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        console.error(err.error || 'Failed to retry request.');
        onActionTriggered(); // revert/refetch
      } else {
        onActionTriggered();
      }
    } catch (err) {
      console.error(err);
      onActionTriggered(); // revert/refetch
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRegenerate = (requestId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Regenerate Knowledge Graph',
      message: 'Are you sure you want to regenerate this Knowledge Graph? This will create a new cloned request using the same configuration.',
      confirmLabel: 'Regenerate Graph',
      onConfirm: async () => {
        setActionLoadingId(requestId);
        try {
          const res = await fetch(`/api/requests/${requestId}/regenerate`, {
            method: 'POST',
          });
          if (!res.ok) {
            const err = await res.json();
            console.error(err.error || 'Failed to regenerate request.');
          } else {
            onActionTriggered();
          }
        } catch (err) {
          console.error(err);
        } finally {
          setActionLoadingId(null);
        }
      },
    });
  };

  const handleOpenModal = (item: RequestItem) => {
    setModalRequest(item);
    setIsClosing(false);
  };

  const handleCloseModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setModalRequest(null);
      setIsClosing(false);
    }, 200);
  };

  const toggleSort = (field: 'title' | 'requestType' | 'status' | 'createdAt') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'createdAt' ? 'desc' : 'asc');
    }
    setCurrentPage(1); // Reset pagination back to page 1 on sort change
  };

  const renderSortIcon = (field: 'title' | 'requestType' | 'status' | 'createdAt') => {
    if (sortField !== field) {
      return (
        <svg className="w-3 h-3 text-zinc-400 opacity-50 hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
        </svg>
      );
    }
    if (sortDirection === 'asc') {
      return (
        <svg className="w-3 h-3 text-zinc-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      );
    }
    return (
      <svg className="w-3 h-3 text-zinc-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    );
  };

  const getStatusBadge = (item: RequestItem) => {
    switch (item.status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200/60 shadow-xs">
            <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-amber-500"></span>
            Pending
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-xs">
            <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-indigo-500 animate-ping"></span>
            Processing
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/60 shadow-xs">
            <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-emerald-500"></span>
            Completed
          </span>
        );
      case 'FAILED':
        return (
          <button
            onClick={() => handleOpenModal(item)}
            className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md bg-rose-50 text-rose-800 border border-rose-200/60 shadow-xs cursor-pointer hover:bg-rose-100/80 hover:border-rose-350 transition-colors"
            title="Click to view error details"
          >
            <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-rose-500"></span>
            Failed
          </button>
        );
      default:
        return null;
    }
  };

  const getTypeBadge = (type: RequestItem['requestType']) => {
    if (type === 'INITIAL') {
      return (
        <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md bg-sky-50 text-sky-700 border border-sky-200/60 shadow-xs whitespace-nowrap">
          Initial
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60 shadow-xs whitespace-nowrap">
        Add
      </span>
    );
  };

  // Filter requests based on search query
  const filteredRequests = requests.filter((r) =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sorting logic
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    // Handle nulls nicely
    if (valA === null || valA === undefined) return sortDirection === 'asc' ? -1 : 1;
    if (valB === null || valB === undefined) return sortDirection === 'asc' ? 1 : -1;

    // Handle Date sorting for createdAt
    if (sortField === 'createdAt') {
      const timeA = new Date(valA).getTime();
      const timeB = new Date(valB).getTime();
      return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
    }

    // Handle string comparisons
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortDirection === 'asc'
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }

    // Default numeric/fallback
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination calculation
  const totalItems = sortedRequests.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const adjustedCurrentPage = currentPage > totalPages ? totalPages : currentPage;

  const startIndex = (adjustedCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedRequests = sortedRequests.slice(startIndex, endIndex);

  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden w-full max-w-7xl">
      {/* Dynamic Keyframes Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes modalSlideUp {
          from {
            transform: translateY(35px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes modalSlideDown {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(35px);
            opacity: 0;
          }
        }
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        .animate-modal-open {
          animation: modalSlideUp 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-modal-close {
          animation: modalSlideDown 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-backdrop-open {
          animation: modalFadeIn 200ms ease-out forwards;
        }
        .animate-backdrop-close {
          animation: modalFadeOut 200ms ease-out forwards;
        }
      `}} />

      {/* Header Panel */}
      <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
            <span>Processing Monitor</span>
            <span className="text-xs font-normal text-zinc-500">({requests.length} total runs)</span>
          </h2>
        </div>

        {/* Search bar inside header */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // Reset to page 1 on search
              }}
              placeholder="Search by title..."
              className="w-full text-xs border border-zinc-200 rounded-lg pl-8 pr-3.5 py-2 text-zinc-900 bg-white placeholder-zinc-400 focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition font-sans"
              style={{ fontFamily: 'inherit' }}
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-zinc-400">
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          {isAnyProcessing && (
            <div className="flex items-center shrink-0 gap-1.5 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-1.5 font-medium">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Active
            </div>
          )}
        </div>
      </div>

      {/* Table grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-zinc-50/75 border-b border-zinc-200 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              {/* Sortable Header: Pipeline Task */}
              <th
                onClick={() => toggleSort('title')}
                className="w-[50%] px-6 py-3.5 font-semibold cursor-pointer select-none hover:text-zinc-900 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  Pipeline Task
                  {renderSortIcon('title')}
                </div>
              </th>

              {/* Sortable Header: Type */}
              <th
                onClick={() => toggleSort('requestType')}
                className="w-[10%] px-6 py-3.5 font-semibold cursor-pointer select-none hover:text-zinc-900 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  Type
                  {renderSortIcon('requestType')}
                </div>
              </th>

              {/* Sortable Header: Status */}
              <th
                onClick={() => toggleSort('status')}
                className="w-[15%] px-6 py-3.5 font-semibold cursor-pointer select-none hover:text-zinc-900 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  Status
                  {renderSortIcon('status')}
                </div>
              </th>

              {/* Sortable Header: Created At */}
              <th
                onClick={() => toggleSort('createdAt')}
                className="w-[20%] px-6 py-3.5 font-semibold cursor-pointer select-none hover:text-zinc-900 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  Created At
                  {renderSortIcon('createdAt')}
                </div>
              </th>

              <th className="w-[20%] px-6 py-3.5 font-semibold text-right select-none">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {paginatedRequests.length > 0 ? (
              paginatedRequests.map((item) => (
                <tr key={item.requestId} className="border-b border-zinc-100 hover:bg-zinc-50/30 transition-colors last:border-0">
                  {/* Title / Name */}
                  <td className="px-6 py-4">
                    <div className="font-bold text-zinc-900 text-sm tracking-tight">{item.title}</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-zinc-550 font-medium">
                      {item.version && (
                        <span className="font-semibold text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded">
                          v{item.version}
                        </span>
                      )}
                      {item.startedAt && item.completedAt && (
                        <span>
                          Time: {((new Date(item.completedAt).getTime() - new Date(item.startedAt).getTime()) / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Request Type */}
                  <td className="px-6 py-4 align-middle">{getTypeBadge(item.requestType)}</td>

                  {/* Status */}
                  <td className="px-6 py-4 align-middle">{getStatusBadge(item)}</td>

                  {/* Created At */}
                  <td className="px-6 py-4 align-middle text-xs text-zinc-500 font-medium">
                    {new Date(item.createdAt).toLocaleString()}
                  </td>

                  {/* Action Buttons */}
                  <td className="px-6 py-4 align-middle text-right">
                    <div className="flex items-center justify-end gap-2.5 h-fit">
                      {actionLoadingId === item.requestId ? (
                        <span className="text-xs text-zinc-400 italic font-medium px-2">Processing...</span>
                      ) : (
                        <>
                          {/* PENDING: RUN PROCESS button (Fully Rounded-Full) */}
                          {item.status === 'PENDING' && (
                            <button
                              onClick={() => handleRun(item.requestId)}
                              disabled={isAnyProcessing}
                              className={`h-8 px-4 text-xs font-bold rounded-full transition duration-150 inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs border ${isAnyProcessing
                                ? 'bg-zinc-50 text-zinc-400 border-zinc-200 cursor-not-allowed shadow-none'
                                : 'bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-900 hover:border-zinc-800'
                                }`}
                              title={isAnyProcessing ? "Wait for other active jobs to complete before running" : "Launch Python processing"}
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                              </svg>
                              Run Process
                            </button>
                          )}

                          {/* COMPLETED actions (Fully Rounded-Full) */}
                          {item.status === 'COMPLETED' && (
                            <>
                              <a
                                href={`/api/results/${item.requestId}/json`}
                                className="h-8 px-4.5 text-xs font-bold bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 hover:border-zinc-300 rounded-full shadow-2xs transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
                                title="Download S-P-O JSON triples"
                              >
                                <svg className="w-3.5 h-3.5 text-zinc-500" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                                JSON
                              </a>
                              <Link
                                href={`/preview/${item.requestId}`}
                                className="h-8 px-4.5 text-xs font-bold bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 hover:border-zinc-300 rounded-full shadow-2xs transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
                                title="Visualize graph in browser"
                              >
                                <svg className="w-3.5 h-3.5 text-zinc-500" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                </svg>
                                Preview
                              </Link>
                              <button
                                onClick={() => handleRegenerate(item.requestId)}
                                className="h-8 px-3 text-xs font-bold text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 border border-transparent hover:border-zinc-200 rounded-full transition duration-150 cursor-pointer"
                                title="Re-run this request configuration as a new request run"
                              >
                                Regenerate
                              </button>
                            </>
                          )}

                          {/* FAILED actions (Fully Rounded-Full) */}
                          {item.status === 'FAILED' && (
                            <button
                              onClick={() => handleRetry(item.requestId)}
                              className="h-8 px-4.5 text-xs font-bold bg-zinc-950 hover:bg-zinc-850 text-white border border-zinc-950 rounded-full shadow-xs transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
                              title="Reset status and try processing again"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                              </svg>
                              Retry
                            </button>
                          )}

                          {/* PROCESSING spinner indicator */}
                          {item.status === 'PROCESSING' && (
                            <span className="text-xs text-zinc-500 italic font-medium px-2.5 py-1 flex items-center gap-1.5">
                              <svg className="animate-spin h-3.5 w-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Running...
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-14 text-center text-sm text-zinc-400 italic font-medium">
                  {searchQuery ? 'No matching requests found.' : 'No requests submitted yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer Panel */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50/30 flex items-center justify-between">
          <span className="text-xs text-zinc-500 font-medium">
            Showing <strong className="text-zinc-900">{startIndex + 1}</strong> to{' '}
            <strong className="text-zinc-900">{endIndex}</strong> of{' '}
            <strong className="text-zinc-900">{totalItems}</strong> entries
          </span>

          <div className="inline-flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={adjustedCurrentPage === 1}
              className={`h-7 px-3 text-xs font-bold rounded shadow-2xs border transition cursor-pointer ${adjustedCurrentPage === 1
                ? 'bg-zinc-50 text-zinc-400 border-zinc-200 cursor-not-allowed shadow-none'
                : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200 hover:border-zinc-300'
                }`}
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={adjustedCurrentPage === totalPages}
              className={`h-7 px-3 text-xs font-bold rounded shadow-2xs border transition cursor-pointer ${adjustedCurrentPage === totalPages
                ? 'bg-zinc-50 text-zinc-400 border-zinc-200 cursor-not-allowed shadow-none'
                : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200 hover:border-zinc-300'
                }`}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ERROR DETAIL MODAL (Overlay backdrop) */}
      {modalRequest && (
        <div
          className={`fixed inset-0 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 ${isClosing ? 'animate-backdrop-close' : 'animate-backdrop-open'
            }`}
          onClick={handleCloseModal}
        >
          <div
            className={`bg-white border border-zinc-200 rounded-xl shadow-lg max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden ${isClosing ? 'animate-modal-close' : 'animate-modal-open'
              }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <h3 className="text-sm font-bold text-zinc-900">
                Pipeline Execution Error
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-zinc-400 hover:text-zinc-600 p-1.5 rounded-full hover:bg-zinc-100 transition cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
                  Pipeline Task Title
                </label>
                <div className="text-sm font-bold text-zinc-900">{modalRequest.title}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
                    Request Type
                  </label>
                  <div>{getTypeBadge(modalRequest.requestType)}</div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
                    Created At
                  </label>
                  <div className="text-xs text-zinc-650 font-medium">
                    {new Date(modalRequest.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1.5">
                  Traceback / Error Log
                </label>
                <div className="bg-rose-50/40 border border-rose-100 rounded-lg p-4 font-mono text-xs text-rose-800 break-words leading-relaxed whitespace-pre-wrap select-all max-h-[30vh] overflow-y-auto">
                  {modalRequest.errorMessage || 'No error message details recorded.'}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4.5 border-t border-zinc-100 bg-zinc-50/50 flex justify-end">
              <button
                onClick={handleCloseModal}
                className="h-8 px-4 text-xs font-bold rounded-full bg-zinc-900 hover:bg-zinc-800 text-white transition cursor-pointer shadow-sm"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmDialog && confirmDialog.isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-backdrop-open cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmDialog(null);
          }}
        >
          <div
            className="bg-white border border-zinc-200 rounded-xl max-w-sm w-full p-6 shadow-xl space-y-4 cursor-default animate-modal-open"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-zinc-950">{confirmDialog.title}</h3>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              {confirmDialog.message}
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-3.5 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  await action();
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg transition cursor-pointer shadow-xs"
              >
                {confirmDialog.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
