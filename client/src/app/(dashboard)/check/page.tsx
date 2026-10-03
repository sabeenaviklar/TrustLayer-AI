'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { ClaimBreakdown } from '@/components/ClaimBreakdown';
import { VerdictBadge } from '@/components/VerdictBadge';
import {
  Sparkles,
  Send,
  Loader2,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';

export default function CheckPlaygroundPage() {
  const { workspace, refreshWorkspace } = useAuth();

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [regenerate, setRegenerate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Quick test demo templates
  const loadPreset = (type: 'supported' | 'contradicted') => {
    if (type === 'supported') {
      setQuestion('Where is TrustLayer located and what plans are offered?');
      setAnswer(
        'TrustLayer is headquartered in San Francisco, California. The platform offers a Free plan with 100 checks and a Pro plan with 5000 checks per month.'
      );
    } else {
      setQuestion('Where is TrustLayer located and when was it founded?');
      setAnswer(
        'TrustLayer was founded in Tokyo, Japan in 1990 and operates data centers on Mars.'
      );
    }
  };

  const handleRunCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    if (!question.trim() || !answer.trim()) {
      setError('Please provide both a Question and an AI Answer to verify.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await api.post(`/v1/workspaces/${workspace.id}/check`, {
        question: question.trim(),
        answer: answer.trim(),
        regenerate,
      });
      setResult(data);
      refreshWorkspace();
    } catch (err: any) {
      setError(err.message || 'Failed to verify answer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              AI Verification Playground
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Submit a prompt and AI answer pair to verify grounding against your uploaded reference documents.
          </p>
        </div>

        {/* Demo Presets */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Load Preset:</span>
          <button
            type="button"
            onClick={() => loadPreset('supported')}
            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold hover:bg-emerald-500/20 transition-all flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Supported</span>
          </button>
          <button
            type="button"
            onClick={() => loadPreset('contradicted')}
            className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold hover:bg-rose-500/20 transition-all flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Hallucinated</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Input Form */}
        <div className="lg:col-span-6 space-y-6">
          <form onSubmit={handleRunCheck} className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                User Question / Prompt
              </label>
              <textarea
                rows={2}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. What is the company refund policy?"
                className="w-full rounded-xl bg-slate-900/90 border border-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                AI-Generated Answer to Verify
              </label>
              <textarea
                rows={5}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Paste the full AI answer here. TrustLayer will split it into claims and run sentence-level NLI against your ingested documents..."
                className="w-full rounded-xl bg-slate-900/90 border border-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all leading-relaxed"
              />
            </div>

            {/* Self-Consistency Option */}
            <div className="pt-2 flex items-center justify-between p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80">
              <div className="flex items-start gap-2.5">
                <RefreshCw className="w-4 h-4 text-indigo-400 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-white">Self-Consistency Verification</p>
                  <p className="text-[11px] text-slate-500">
                    Runs multi-sampling agreement checks across claims
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={regenerate}
                  onChange={(e) => setRegenerate(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !question.trim() || !answer.trim()}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Evaluating Claims & Ingested Vectors...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-200 group-hover:scale-110 transition-transform" />
                  <span>Verify Answer Against Documents</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Tip Box */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-start gap-3">
            <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 leading-relaxed">
              Make sure you have uploaded reference documents in the{' '}
              <a href="/documents" className="text-indigo-400 underline hover:text-indigo-300">
                Documents
              </a>{' '}
              tab. The AI pipeline matches claims against your workspace's ChromaDB collection.
            </p>
          </div>
        </div>

        {/* Right Output Panel */}
        <div className="lg:col-span-6 space-y-6">
          {loading && (
            <div className="glass-panel rounded-2xl p-12 border border-slate-800 flex flex-col items-center justify-center text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
                </div>
              </div>
              <h4 className="text-base font-bold text-white mt-6">Grounding Verification in Progress</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                1. Tokenizing answer into testable claims...<br />
                2. Performing semantic similarity retrieval from ChromaDB...<br />
                3. Running NLI cross-encoder model...
              </p>
            </div>
          )}

          {!loading && !result && (
            <div className="glass-panel rounded-2xl p-12 border border-slate-800/60 text-center flex flex-col items-center justify-center min-h-[380px]">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 shadow-inner">
                <Sparkles className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-white">No Verification Run Yet</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                Enter a question and answer on the left or click a preset to see real-time claim verification with highlighted evidence sentences.
              </p>
            </div>
          )}

          {!loading && result && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <ClaimBreakdown
                claims={result.claims}
                overallVerdict={result.overallVerdict}
                reliabilityScore={result.reliabilityScore}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
