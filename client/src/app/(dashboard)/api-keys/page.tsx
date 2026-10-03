'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  Code2,
  Terminal,
  ShieldAlert,
  Loader2,
} from 'lucide-react';

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt?: string;
  createdAt: string;
}

export default function ApiKeysPage() {
  const { workspace } = useAuth();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyName, setKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = async () => {
    if (!workspace) return;
    try {
      setLoading(true);
      const data = await api.get<ApiKeyItem[]>(`/v1/workspaces/${workspace.id}/api-keys`);
      setKeys(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [workspace?.id]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !keyName.trim()) return;

    setCreating(true);
    setError(null);

    try {
      const res = await api.post<any>(`/v1/workspaces/${workspace.id}/api-keys`, {
        name: keyName.trim(),
      });
      setNewKeySecret(res.secretKey);
      setKeyName('');
      await fetchKeys();
    } catch (err: any) {
      setError(err.message || 'Failed to generate key');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!workspace) return;
    if (!confirm('Are you sure you want to revoke this API key? External apps using this key will immediately lose access.')) return;

    try {
      await api.delete(`/v1/workspaces/${workspace.id}/api-keys/${keyId}`);
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch (err: any) {
      setError(err.message || 'Failed to revoke key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Developer API Keys
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage API keys for programmatically submitting AI generations to TrustLayer via <code className="text-indigo-400 font-mono text-xs">POST /api/v1/check</code>.
        </p>
      </div>

      {/* Generator Box */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Key className="w-4 h-4 text-indigo-400" />
          <span>Generate New API Key</span>
        </h3>

        <form onSubmit={handleCreateKey} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="e.g. Production LangChain Pipeline, CI/CD Evaluator"
            className="flex-1 rounded-xl bg-slate-900 border border-slate-800 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={creating || !keyName.trim()}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-indigo-600/20"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            <span>Create Key</span>
          </button>
        </form>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Secret Key Notification Modal / Banner */}
        {newKeySecret && (
          <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/40 space-y-3 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                <span>API Key Generated Successfully</span>
              </span>
              <button
                onClick={() => setNewKeySecret(null)}
                className="text-[11px] text-slate-400 hover:text-white"
              >
                Dismiss
              </button>
            </div>
            <p className="text-xs text-slate-300">
              Please copy your secret key right now. For security purposes, this key will <strong>never be shown again</strong>.
            </p>
            <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-slate-950 font-mono text-xs text-indigo-300 border border-indigo-500/20">
              <span className="truncate">{newKeySecret}</span>
              <button
                onClick={() => copyToClipboard(newKeySecret)}
                className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Keys List */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Active Keys ({keys.length})
            </h3>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            <p className="text-xs text-slate-400 mt-2">Loading API keys...</p>
          </div>
        ) : keys.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Key className="w-10 h-10 text-slate-600 mb-3" />
            <h4 className="text-sm font-bold text-white">No API Keys Generated</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Generate an API key above to integrate TrustLayer with your Python, Node, or LangChain pipelines.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-5">Key Name</th>
                  <th className="py-3.5 px-4">Prefix</th>
                  <th className="py-3.5 px-4">Created Date</th>
                  <th className="py-3.5 px-4">Last Used</th>
                  <th className="py-3.5 px-4 text-right">Revoke</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3.5 px-5 font-semibold text-white">{k.name}</td>
                    <td className="py-3.5 px-4 font-mono text-indigo-400">{k.keyPrefix}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleRevoke(k.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Revoke key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Code Integration Example */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Quick Integration Snippet
          </h3>
        </div>
        <p className="text-xs text-slate-400">
          Make a POST request to <code className="text-indigo-300">/api/v1/check</code> using your API key in the <code className="text-indigo-300">X-API-Key</code> header:
        </p>

        <div className="p-4 rounded-xl bg-slate-950 font-mono text-xs text-slate-300 border border-slate-800 overflow-x-auto leading-relaxed">
          <span className="text-slate-500"># cURL Example</span>
          <br />
          <span className="text-indigo-400">curl</span> -X POST https://yourdomain.com/api/v1/check \
          <br />
          &nbsp;&nbsp;-H <span className="text-emerald-300">"Content-Type: application/json"</span> \
          <br />
          &nbsp;&nbsp;-H <span className="text-emerald-300">"X-API-Key: tl_live_your_key_here"</span> \
          <br />
          &nbsp;&nbsp;-d <span className="text-amber-300">'{JSON.stringify({ question: 'What is the refund period?', answer: 'Customers can request a refund within 30 days.' }, null, 2)}'</span>
        </div>
      </div>
    </div>
  );
}
