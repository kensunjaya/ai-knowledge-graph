"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { TopProgressBar } from '@/components/top-progress-bar';

interface Provider {
  id: number;
  name: string;
  category: string | null;
  baseUrl: string | null;
  description: string | null;
  iconSvg: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SecretMetadata {
  id: string;
  providerId: number;
  providerName: string | null;
  providerCategory: string | null;
  providerIconSvg: string | null;
  name: string;
  description: string | null;
  version: number;
  isActive: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Tag {
  id: number;
  name: string;
}

function ProviderIcon({ svg, className = "w-5 h-5 text-zinc-700" }: { svg?: string | null; className?: string }) {
  if (!svg || !svg.trim()) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    );
  }
  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default function SecretManagerPage() {
  const [activeTab, setActiveTab] = useState<'secrets' | 'providers' | 'tags'>('secrets');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [secrets, setSecrets] = useState<SecretMetadata[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sort states for Secrets
  type SecretSortField = 'name' | 'providerName' | 'isActive' | 'version' | 'lastUsedAt';
  const [secretSortField, setSecretSortField] = useState<SecretSortField>('name');
  const [secretSortDir, setSecretSortDir] = useState<'asc' | 'desc'>('asc');

  // Sort states for Providers
  type ProviderSortField = 'name' | 'category' | 'baseUrl';
  const [providerSortField, setProviderSortField] = useState<ProviderSortField>('name');
  const [providerSortDir, setProviderSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSecretSort = (field: SecretSortField) => {
    if (secretSortField === field) {
      setSecretSortDir(secretSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSecretSortField(field);
      setSecretSortDir('asc');
    }
  };

  const toggleProviderSort = (field: ProviderSortField) => {
    if (providerSortField === field) {
      setProviderSortDir(providerSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setProviderSortField(field);
      setProviderSortDir('asc');
    }
  };

  const renderSortIcon = (activeField: string, currentField: string, dir: 'asc' | 'desc') => {
    if (activeField !== currentField) {
      return (
        <svg className="w-3 h-3 text-zinc-400 opacity-40 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
        </svg>
      );
    }
    if (dir === 'asc') {
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);

  const [showSecretModal, setShowSecretModal] = useState(false);
  const [editingSecret, setEditingSecret] = useState<SecretMetadata | null>(null);

  const [showTagModal, setShowTagModal] = useState(false);

  // Master Key Prompt Modal for Reveal/Copy
  const [revealTarget, setRevealTarget] = useState<{ secret: SecretMetadata; action: 'reveal' | 'copy' } | null>(null);
  const [masterKeyInput, setMasterKeyInput] = useState('');
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // Provider Form State
  const [providerForm, setProviderForm] = useState({
    name: '',
    category: '',
    baseUrl: '',
    description: '',
    iconSvg: '',
  });

  // Secret Form State
  const [secretForm, setSecretForm] = useState({
    name: '',
    providerId: '',
    description: '',
    value: '',
    masterKey: '',
    isActive: true,
    expiresAt: '',
  });

  // Tag Form State
  const [tagNameInput, setTagNameInput] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/secret/providers');
      if (res.ok) setProviders(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchSecrets = useCallback(async () => {
    try {
      const res = await fetch('/api/secret/secrets');
      if (res.ok) setSecrets(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/secret/tags');
      if (res.ok) setTags(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchProviders(), fetchSecrets(), fetchTags()]);
    setLoading(false);
  }, [fetchProviders, fetchSecrets, fetchTags]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // SVG File Upload Handler
  const handleSvgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') {
      alert('Please select a valid .svg file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setProviderForm((prev) => ({ ...prev, iconSvg: content.trim() }));
        showToast('SVG file loaded!');
      }
    };
    reader.readAsText(file);
  };

  // Provider CRUD Handlers
  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerForm.name.trim()) return;

    try {
      const url = '/api/secret/providers';
      const method = editingProvider ? 'PUT' : 'POST';
      const body = editingProvider ? { id: editingProvider.id, ...providerForm } : providerForm;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        showToast(editingProvider ? 'Provider updated!' : 'Provider created!');
        setShowProviderModal(false);
        setEditingProvider(null);
        setProviderForm({ name: '', category: '', baseUrl: '', description: '', iconSvg: '' });
        fetchProviders();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save provider');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteProvider = async (id: number) => {
    if (!confirm('Are you sure you want to delete this provider?')) return;
    try {
      const res = await fetch(`/api/secret/providers?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Provider deleted!');
        fetchProviders();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete provider');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Secret CRUD Handlers
  const handleSaveSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretForm.name.trim() || !secretForm.providerId) return;
    if (!editingSecret && (!secretForm.value || !secretForm.masterKey)) {
      alert('Secret value and Master Key are required for new secrets');
      return;
    }

    try {
      const url = '/api/secret/secrets';
      const method = editingSecret ? 'PUT' : 'POST';
      const body = editingSecret ? { id: editingSecret.id, ...secretForm } : secretForm;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        showToast(editingSecret ? 'Secret updated!' : 'Secret created!');
        setShowSecretModal(false);
        setEditingSecret(null);
        setSecretForm({ name: '', providerId: '', description: '', value: '', masterKey: '', isActive: true, expiresAt: '' });
        fetchSecrets();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save secret');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSecret = async (id: string) => {
    if (!confirm('Are you sure you want to delete this secret?')) return;
    try {
      const res = await fetch(`/api/secret/secrets?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Secret deleted!');
        fetchSecrets();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete secret');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Tag CRUD Handlers
  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagNameInput.trim()) return;

    try {
      const res = await fetch('/api/secret/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tagNameInput.trim() }),
      });

      if (res.ok) {
        showToast('Tag created!');
        setTagNameInput('');
        setShowTagModal(false);
        fetchTags();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create tag');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTag = async (id: number) => {
    if (!confirm('Are you sure you want to delete this tag?')) return;
    try {
      const res = await fetch(`/api/secret/tags?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Tag deleted!');
        fetchTags();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Master Key Reveal / Copy Handler
  const handleDecryptSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revealTarget || !masterKeyInput) return;

    setIsDecrypting(true);
    setRevealError(null);

    try {
      const res = await fetch('/api/secret/secrets/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: revealTarget.secret.id,
          masterKey: masterKeyInput,
        }),
      });

      const data = await res.json();

      if (res.ok && data.value) {
        if (revealTarget.action === 'copy') {
          await navigator.clipboard.writeText(data.value);
          showToast('Secret copied to clipboard!');
          closeRevealModal();
        } else {
          setRevealedValue(data.value);
        }
        fetchSecrets();
      } else {
        setRevealError(data.error || 'Decryption failed. Please check your Master Key.');
      }
    } catch (e: any) {
      setRevealError(e.message || 'Decryption request failed.');
    } finally {
      setIsDecrypting(false);
    }
  };

  const closeRevealModal = () => {
    setRevealTarget(null);
    setMasterKeyInput('');
    setRevealedValue(null);
    setRevealError(null);
  };

  // Filtered lists
  const filteredSecrets = secrets.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.providerName && s.providerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredProviders = providers.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const sortedSecrets = [...filteredSecrets].sort((a, b) => {
    let valA: any = a[secretSortField];
    let valB: any = b[secretSortField];

    if (valA === null || valA === undefined) return secretSortDir === 'asc' ? -1 : 1;
    if (valB === null || valB === undefined) return secretSortDir === 'asc' ? 1 : -1;

    if (secretSortField === 'lastUsedAt') {
      const timeA = new Date(valA).getTime();
      const timeB = new Date(valB).getTime();
      return secretSortDir === 'asc' ? timeA - timeB : timeB - timeA;
    }

    if (typeof valA === 'boolean') {
      const numA = valA ? 1 : 0;
      const numB = valB ? 1 : 0;
      return secretSortDir === 'asc' ? numA - numB : numB - numA;
    }

    if (typeof valA === 'number' && typeof valB === 'number') {
      return secretSortDir === 'asc' ? valA - valB : valB - valA;
    }

    if (typeof valA === 'string' && typeof valB === 'string') {
      return secretSortDir === 'asc'
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }

    return 0;
  });

  const sortedProviders = [...filteredProviders].sort((a, b) => {
    let valA: any = a[providerSortField];
    let valB: any = b[providerSortField];

    if (valA === null || valA === undefined) return providerSortDir === 'asc' ? -1 : 1;
    if (valB === null || valB === undefined) return providerSortDir === 'asc' ? 1 : -1;

    if (typeof valA === 'string' && typeof valB === 'string') {
      return providerSortDir === 'asc'
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }

    return 0;
  });

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 flex flex-col">
      <TopProgressBar show={loading || isDecrypting} />
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-zinc-950 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-lg border border-zinc-800 animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* Top Header */}
      <header className="bg-white border-b border-zinc-200 py-4 px-6 sticky top-0 z-30 shadow-xs">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-zinc-600 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200/80 transition-all cursor-pointer shadow-2xs group"
            >
              <svg className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-950 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              <span>Portal</span>
            </Link>
            <div className="h-4 w-[1px] bg-zinc-200" />
            <div className="flex items-center gap-2">
              {/* Padlock Icon */}
              <svg className="w-5 h-5 text-zinc-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h1 className="text-md font-bold tracking-tight text-zinc-950">
                Secret Manager
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Wide Layout with Sidebar */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full md:w-56 shrink-0 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-3 pb-2">
            Navigation
          </div>

          <button
            onClick={() => setActiveTab('secrets')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${activeTab === 'secrets'
              ? 'bg-zinc-900 text-white shadow-xs'
              : 'text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900'
              }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Secrets
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'secrets' ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-200 text-zinc-600'}`}>
              {secrets.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('providers')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${activeTab === 'providers'
              ? 'bg-zinc-900 text-white shadow-xs'
              : 'text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900'
              }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Providers
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'providers' ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-200 text-zinc-600'}`}>
              {providers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tags')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${activeTab === 'tags'
              ? 'bg-zinc-900 text-white shadow-xs'
              : 'text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900'
              }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Tags
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'tags' ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-200 text-zinc-600'}`}>
              {tags.length}
            </span>
          </button>
        </aside>

        {/* Main Wide Content Area */}
        <main className="flex-1 bg-white border border-zinc-200 rounded-xl p-6 shadow-xs flex flex-col min-h-[550px] w-full overflow-hidden">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-zinc-100">
            <div>
              <h2 className="text-lg font-bold text-zinc-950 capitalize">
                {activeTab} Management
              </h2>
              <p className="text-xs text-zinc-500">
                {activeTab === 'secrets' && 'Encrypted application secrets, keys, and tokens.'}
                {activeTab === 'providers' && 'Service providers and dynamic SVG icons.'}
                {activeTab === 'tags' && 'Tag labels for secret classification.'}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs border border-zinc-300 focus:border-zinc-900 rounded-lg px-3 py-2 w-full sm:w-56 outline-none transition"
              />

              {activeTab === 'secrets' && (
                <button
                  onClick={() => {
                    setEditingSecret(null);
                    setSecretForm({ name: '', providerId: providers[0]?.id.toString() || '', description: '', value: '', masterKey: '', isActive: true, expiresAt: '' });
                    setShowSecretModal(true);
                  }}
                  className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition whitespace-nowrap shadow-xs cursor-pointer"
                >
                  + New Secret
                </button>
              )}

              {activeTab === 'providers' && (
                <button
                  onClick={() => {
                    setEditingProvider(null);
                    setProviderForm({ name: '', category: '', baseUrl: '', description: '', iconSvg: '' });
                    setShowProviderModal(true);
                  }}
                  className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition whitespace-nowrap shadow-xs cursor-pointer"
                >
                  + New Provider
                </button>
              )}

              {activeTab === 'tags' && (
                <button
                  onClick={() => setShowTagModal(true)}
                  className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition whitespace-nowrap shadow-xs cursor-pointer"
                >
                  + New Tag
                </button>
              )}
            </div>
          </div>

          {/* TAB 1: SECRETS TABLE */}
          {activeTab === 'secrets' && (
            <div className="flex-1 overflow-x-auto mt-4 w-full">
              {loading ? (
                <div className="py-12 text-center text-xs text-zinc-400">Loading secrets vault...</div>
              ) : filteredSecrets.length === 0 ? (
                <div className="py-16 text-center text-xs text-zinc-400 italic">No secrets found.</div>
              ) : (
                <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-500 font-bold uppercase text-[10px] tracking-wider select-none">
                      <th className="py-3.5 px-4 cursor-pointer group" onClick={() => toggleSecretSort('name')}>
                        <div className="flex items-center gap-1.5 hover:text-zinc-950 transition">
                          <span>Name</span>
                          {renderSortIcon(secretSortField, 'name', secretSortDir)}
                        </div>
                      </th>
                      <th className="py-3.5 px-4 cursor-pointer group" onClick={() => toggleSecretSort('providerName')}>
                        <div className="flex items-center gap-1.5 hover:text-zinc-950 transition">
                          <span>Provider</span>
                          {renderSortIcon(secretSortField, 'providerName', secretSortDir)}
                        </div>
                      </th>
                      <th className="py-3.5 px-4 cursor-pointer group" onClick={() => toggleSecretSort('isActive')}>
                        <div className="flex items-center gap-1.5 hover:text-zinc-950 transition">
                          <span>Status</span>
                          {renderSortIcon(secretSortField, 'isActive', secretSortDir)}
                        </div>
                      </th>
                      <th className="py-3.5 px-4 cursor-pointer group" onClick={() => toggleSecretSort('version')}>
                        <div className="flex items-center gap-1.5 hover:text-zinc-950 transition">
                          <span>Version</span>
                          {renderSortIcon(secretSortField, 'version', secretSortDir)}
                        </div>
                      </th>
                      <th className="py-3.5 px-4 cursor-pointer group" onClick={() => toggleSecretSort('lastUsedAt')}>
                        <div className="flex items-center gap-1.5 hover:text-zinc-950 transition">
                          <span>Last Used</span>
                          {renderSortIcon(secretSortField, 'lastUsedAt', secretSortDir)}
                        </div>
                      </th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {sortedSecrets.map((secret) => (
                      <tr key={secret.id} className="hover:bg-zinc-50/80 transition">
                        {/* Normal Font for Secret Name */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-zinc-950 text-sm">
                            {secret.name}
                          </div>
                          {secret.description && (
                            <div className="text-xs text-zinc-400 font-normal truncate max-w-sm mt-0.5">
                              {secret.description}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <ProviderIcon svg={secret.providerIconSvg} className="w-4 h-4" />
                            <span className="font-medium text-zinc-800">{secret.providerName || 'Unknown'}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {secret.isActive ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-semibold bg-zinc-100 text-zinc-500 border border-zinc-200">
                              Inactive
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-zinc-500">v{secret.version}</td>

                        <td className="py-3.5 px-4 text-zinc-400 text-xs">
                          {secret.lastUsedAt ? new Date(secret.lastUsedAt).toLocaleDateString() : 'Never'}
                        </td>

                        {/* Actions column: Clean Icon Buttons */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            {/* Reveal Icon Button */}
                            <button
                              title="Reveal Secret"
                              onClick={() => {
                                setRevealTarget({ secret, action: 'reveal' });
                                setMasterKeyInput('');
                                setRevealedValue(null);
                              }}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 transition cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>

                            {/* Edit Icon Button */}
                            <button
                              title="Edit Secret"
                              onClick={() => {
                                setEditingSecret(secret);
                                setSecretForm({
                                  name: secret.name,
                                  providerId: secret.providerId.toString(),
                                  description: secret.description || '',
                                  value: '',
                                  masterKey: '',
                                  isActive: secret.isActive,
                                  expiresAt: secret.expiresAt ? secret.expiresAt.substring(0, 10) : '',
                                });
                                setShowSecretModal(true);
                              }}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 transition cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>

                            {/* Delete Icon Button */}
                            <button
                              title="Delete Secret"
                              onClick={() => handleDeleteSecret(secret.id)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 2: PROVIDERS TABLE */}
          {activeTab === 'providers' && (
            <div className="flex-1 overflow-x-auto mt-4 w-full">
              {loading ? (
                <div className="py-12 text-center text-xs text-zinc-400">Loading providers...</div>
              ) : filteredProviders.length === 0 ? (
                <div className="py-16 text-center text-xs text-zinc-400 italic">No providers found.</div>
              ) : (
                <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-500 font-bold uppercase text-[10px] tracking-wider select-none">
                      <th className="py-3.5 px-4">Icon</th>
                      <th className="py-3.5 px-4 cursor-pointer group" onClick={() => toggleProviderSort('name')}>
                        <div className="flex items-center gap-1.5 hover:text-zinc-950 transition">
                          <span>Name</span>
                          {renderSortIcon(providerSortField, 'name', providerSortDir)}
                        </div>
                      </th>
                      <th className="py-3.5 px-4 cursor-pointer group" onClick={() => toggleProviderSort('category')}>
                        <div className="flex items-center gap-1.5 hover:text-zinc-950 transition">
                          <span>Category</span>
                          {renderSortIcon(providerSortField, 'category', providerSortDir)}
                        </div>
                      </th>
                      <th className="py-3.5 px-4 cursor-pointer group" onClick={() => toggleProviderSort('baseUrl')}>
                        <div className="flex items-center gap-1.5 hover:text-zinc-950 transition">
                          <span>Base URL</span>
                          {renderSortIcon(providerSortField, 'baseUrl', providerSortDir)}
                        </div>
                      </th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {sortedProviders.map((provider) => (
                      <tr key={provider.id} className="hover:bg-zinc-50/80 transition">
                        <td className="py-3.5 px-4">
                          <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center border border-zinc-200/60">
                            <ProviderIcon svg={provider.iconSvg} className="w-5 h-5" />
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-zinc-950 text-sm">
                            {provider.name}
                          </div>
                          {provider.description && (
                            <div className="text-xs text-zinc-400 font-normal truncate max-w-sm mt-0.5">
                              {provider.description}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {provider.category ? (
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200">
                              {provider.category}
                            </span>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-zinc-500 text-xs">
                          {provider.baseUrl || '-'}
                        </td>

                        {/* Actions column: Clean Icon Buttons */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            {/* Edit Icon Button */}
                            <button
                              title="Edit Provider"
                              onClick={() => {
                                setEditingProvider(provider);
                                setProviderForm({
                                  name: provider.name,
                                  category: provider.category || '',
                                  baseUrl: provider.baseUrl || '',
                                  description: provider.description || '',
                                  iconSvg: provider.iconSvg || '',
                                });
                                setShowProviderModal(true);
                              }}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 transition cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>

                            {/* Delete Icon Button */}
                            <button
                              title="Delete Provider"
                              onClick={() => handleDeleteProvider(provider.id)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 3: TAGS */}
          {activeTab === 'tags' && (
            <div className="flex-1 mt-4">
              {tags.length === 0 ? (
                <div className="py-16 text-center text-xs text-zinc-400 italic">No tags created yet.</div>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-2 bg-zinc-100 border border-zinc-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-800"
                    >
                      <span>#{tag.name}</span>
                      <button
                        onClick={() => handleDeleteTag(tag.id)}
                        className="text-zinc-400 hover:text-rose-600 transition cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* MASTER KEY REVEAL MODAL */}
      {revealTarget && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeRevealModal();
          }}
        >
          <div
            className="bg-white border border-zinc-200 rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-zinc-950">
              Reveal Secret
            </h3>

            <p className="text-xs text-zinc-500">
              Enter your Master Key to decrypt <span className="font-semibold text-zinc-900">{revealTarget.secret.name}</span>.
              The Master Key is processed in memory and never saved.
            </p>

            {revealError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg font-medium">
                {revealError}
              </div>
            )}

            {!revealedValue ? (
              <form onSubmit={handleDecryptSecret} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Master Key
                  </label>
                  <input
                    type="password"
                    autoFocus
                    required
                    value={masterKeyInput}
                    onChange={(e) => setMasterKeyInput(e.target.value)}
                    placeholder="Enter master key..."
                    className="w-full text-xs border border-zinc-300 focus:border-zinc-900 rounded-lg p-2.5 outline-none font-mono"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeRevealModal}
                    className="px-3.5 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDecrypting}
                    className="px-4 py-2 text-xs font-semibold bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg transition cursor-pointer"
                  >
                    {isDecrypting ? 'Decrypting...' : 'Submit Key'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="bg-zinc-900 text-emerald-400 font-mono text-xs p-3 rounded-lg break-all select-all border border-zinc-800">
                  {revealedValue}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(revealedValue);
                      showToast('Copied to clipboard!');
                    }}
                    className="px-3.5 py-2 text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-lg cursor-pointer"
                  >
                    Copy to Clipboard
                  </button>
                  <button
                    onClick={closeRevealModal}
                    className="px-4 py-2 text-xs font-semibold bg-zinc-950 text-white rounded-lg cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE / EDIT PROVIDER MODAL WITH SVG FILE UPLOAD & TEXTAREA DESCRIPTION */}
      {showProviderModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowProviderModal(false);
          }}
        >
          <div
            className="bg-white border border-zinc-200 rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-zinc-950">
              {editingProvider ? 'Edit Provider' : 'Create New Provider'}
            </h3>

            <form onSubmit={handleSaveProvider} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. OpenAI"
                  value={providerForm.name}
                  onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                  className="w-full text-xs border border-zinc-300 focus:border-zinc-900 rounded-lg p-2.5 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. AI / Database"
                    value={providerForm.category}
                    onChange={(e) => setProviderForm({ ...providerForm, category: e.target.value })}
                    className="w-full text-xs border border-zinc-300 focus:border-zinc-900 rounded-lg p-2.5 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Base URL</label>
                  <input
                    type="text"
                    placeholder="e.g. https://api.openai.com"
                    value={providerForm.baseUrl}
                    onChange={(e) => setProviderForm({ ...providerForm, baseUrl: e.target.value })}
                    className="w-full text-xs border border-zinc-300 focus:border-zinc-900 rounded-lg p-2.5 outline-none font-mono"
                  />
                </div>
              </div>

              {/* Description Textarea */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief provider description..."
                  value={providerForm.description}
                  onChange={(e) => setProviderForm({ ...providerForm, description: e.target.value })}
                  className="w-full text-xs border border-zinc-300 focus:border-zinc-900 rounded-lg p-2.5 outline-none"
                />
              </div>

              {/* Icon SVG: Textarea + File Upload */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-zinc-700">Icon SVG String</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".svg,image/svg+xml"
                    onChange={handleSvgFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] font-semibold text-zinc-700 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 px-2 py-1 rounded transition cursor-pointer flex items-center gap-1"
                  >
                    <svg className="w-3 h-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload .SVG File
                  </button>
                </div>

                <textarea
                  rows={3}
                  placeholder='<svg ...>...</svg> or click upload above'
                  value={providerForm.iconSvg}
                  onChange={(e) => setProviderForm({ ...providerForm, iconSvg: e.target.value })}
                  className="w-full text-xs border border-zinc-300 focus:border-zinc-900 rounded-lg p-2.5 outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowProviderModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 cursor-pointer"
                >
                  Save Provider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT SECRET MODAL WITH TEXTAREA DESCRIPTION */}
      {showSecretModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSecretModal(false);
          }}
        >
          <div
            className="bg-white border border-zinc-200 rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-zinc-950">
              {editingSecret ? 'Edit Secret' : 'Create New Secret'}
            </h3>

            <form onSubmit={handleSaveSecret} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Secret Name / Identifier *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. OPENAI_MAIN or DISCORD_BOT"
                  value={secretForm.name}
                  onChange={(e) => setSecretForm({ ...secretForm, name: e.target.value })}
                  className="w-full text-xs border border-zinc-300 focus:border-zinc-900 rounded-lg p-2.5 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Provider *</label>
                <select
                  required
                  value={secretForm.providerId}
                  onChange={(e) => setSecretForm({ ...secretForm, providerId: e.target.value })}
                  className="w-full text-xs border border-zinc-300 focus:border-zinc-900 rounded-lg p-2.5 outline-none bg-white cursor-pointer"
                >
                  <option value="">Select a provider...</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Description Textarea */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Production OpenAI API Key for agent application"
                  value={secretForm.description}
                  onChange={(e) => setSecretForm({ ...secretForm, description: e.target.value })}
                  className="w-full text-xs border border-zinc-300 focus:border-zinc-900 rounded-lg p-2.5 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Secret Value {editingSecret ? '(Leave blank to keep existing)' : '*'}
                </label>
                <textarea
                  rows={2}
                  required={!editingSecret}
                  placeholder="Paste plaintext key/secret value here..."
                  value={secretForm.value}
                  onChange={(e) => setSecretForm({ ...secretForm, value: e.target.value })}
                  className="w-full text-xs border border-zinc-300 focus:border-zinc-900 rounded-lg p-2.5 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Master Key {editingSecret && !secretForm.value ? '(Optional unless updating value)' : '*'}
                </label>
                <input
                  type="password"
                  required={!editingSecret || Boolean(secretForm.value)}
                  placeholder="Enter master key for encryption..."
                  value={secretForm.masterKey}
                  onChange={(e) => setSecretForm({ ...secretForm, masterKey: e.target.value })}
                  className="w-full text-xs border border-zinc-300 focus:border-zinc-900 rounded-lg p-2.5 outline-none font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={secretForm.isActive}
                  onChange={(e) => setSecretForm({ ...secretForm, isActive: e.target.checked })}
                  className="rounded text-zinc-900 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="isActiveCheck" className="text-xs font-semibold text-zinc-700 cursor-pointer">
                  Active Secret
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSecretModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 cursor-pointer"
                >
                  Save Secret
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE TAG MODAL */}
      {showTagModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTagModal(false);
          }}
        >
          <div
            className="bg-white border border-zinc-200 rounded-xl max-w-sm w-full p-6 shadow-xl space-y-4 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-zinc-950">Create New Tag</h3>

            <form onSubmit={handleCreateTag} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Tag Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. production, ai, bot"
                  value={tagNameInput}
                  onChange={(e) => setTagNameInput(e.target.value)}
                  className="w-full text-xs border border-zinc-300 focus:border-zinc-900 rounded-lg p-2.5 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTagModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 cursor-pointer"
                >
                  Create Tag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
