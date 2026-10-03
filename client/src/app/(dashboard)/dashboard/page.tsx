'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { MetricCard } from '@/components/MetricCard';
import { TrendChart } from '@/components/TrendChart';
import { VerdictBadge } from '@/components/VerdictBadge';
import { ClaimBreakdown } from '@/components/ClaimBreakdown';
import {
  ShieldAlert,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Eye,
  X,
  FileText,
  AlertTriangle,
  Zap,
} from 'lucide-react';

interface AnalyticsData {
  totalChecks: number;
  supportedCount: number;
  contradictedCount: number;
  unverifiableCount: number;
  hallucinationRate: number;
  supportedRate: number;
  unverifiableRate: number;
  usage?: {
    checkCount: number;
    limit: number;
    remaining: number;
  };
  dailyTrend: Array<{
    date: string;
    totalChecks: number;
    contradicted: number;
    supported: number;
    hallucinationRate: number;
    avgReliability?: number;
  }>;
}

interface CheckItem {
  _id: string;
  question: string;
  answer: string;
  overallVerdict: string;
  reliabilityScore: number;
  totalClaims: number;
  supportedCount: number;
  contradictedCount: number;
  unverifiableCount: number;
  claims: any[];
  checkedBy: string;
  createdAt: string;
}

export default function DashboardOverviewPage() {
  const { workspace } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [recentChecks, setRecentChecks] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCheck, setSelectedCheck] = useState<CheckItem | null>(null);

  const fetchDashboardData = async () => {
    if (!workspace) return;
    try {
      setLoading(true);
      const [anaData, checksData] = await Promise.all([
        api.get<AnalyticsData>(`/v1/workspaces/${workspace.id}/analytics`),
        api.get<{ items: CheckItem[] }>(`/v1/workspaces/${workspace.id}/checks?limit=6`),
      ]);

      setAnalytics(anaData);
      setRecentChecks(checksData.items || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [workspace?.id]);

  const hallucinationBadgeType =
    (analytics?.hallucinationRate || 0) > 15
      ? 'negative'
      : (analytics?.hallucinationRate || 0) > 0
      ? 'negative'
      : 'positive';

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl glass-panel border border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/50 to-indigo-950/20">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
            Workspace Overview
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
            {workspace?.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time truth grounding engine tracking model accuracy and source hallucination rates.
          </p>
        </div>

        <Link
          href="/check"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition-all group shrink-0"
        >
          <Sparkles className="w-4 h-4 text-indigo-200 group-hover:scale-110 transition-transform" />
          <span>New AI Verification</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MetricCard
          title="Total Checks"
          value={analytics?.totalChecks ?? 0}
          subtext={`${analytics?.usage?.remaining ?? 0} quota checks remaining`}
          icon={Zap}
          accentColor="indigo"
          badge={{
            text: `${analytics?.usage?.checkCount ?? 0} / ${analytics?.usage?.limit ?? 100}`,
            type: 'info',
          }}
        />

        <MetricCard
          title="Hallucination Rate"
          value={`${analytics?.hallucinationRate ?? 0}%`}
          subtext={`${analytics?.contradictedCount ?? 0} contradictory answers`}
          icon={AlertTriangle}
          accentColor="rose"
          badge={{
            text: `${analytics?.hallucinationRate ?? 0}% Flagged`,
            type: hallucinationBadgeType,
          }}
        />

        <MetricCard
          title="Grounding Rate"
          value={`${analytics?.supportedRate ?? 0}%`}
          subtext={`${analytics?.supportedCount ?? 0} fully supported answers`}
          icon={CheckCircle2}
          accentColor="emerald"
          badge={{
            text: 'Ground Truth',
            type: 'positive',
          }}
        />

        <MetricCard
          title="Unverifiable Rate"
          value={`${analytics?.unverifiableRate ?? 0}%`}
          subtext={`${analytics?.unverifiableCount ?? 0} out-of-domain answers`}
          icon={HelpCircle}
          accentColor="amber"
          badge={{
            text: 'Missing Context',
            type: 'neutral',
          }}
        />
      </div>

      {/* Trendline Chart */}
      <TrendChart data={analytics?.dailyTrend || []} />

      {/* Recent Verifications Table with Evidence Preview */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Recent Model Verifications
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click "Inspect" on any answer to view claim verdicts and extracted evidence sentences.
            </p>
          </div>
          <Link
            href="/history"
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentChecks.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Sparkles className="w-8 h-8 text-slate-600 mb-2" />
            <h4 className="text-sm font-bold text-white">No verifications yet</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Run your first check in the playground to begin monitoring hallucination metrics.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-5">Prompt</th>
                  <th className="py-3.5 px-4">Verdict</th>
                  <th className="py-3.5 px-4">Reliability</th>
                  <th className="py-3.5 px-4">Claims</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {recentChecks.map((chk) => (
                  <tr key={chk._id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3.5 px-5 max-w-sm">
                      <div className="font-semibold text-white truncate">{chk.question}</div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">{chk.answer}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <VerdictBadge verdict={chk.overallVerdict} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-200">
                      {Math.round(chk.reliabilityScore)}%
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">{chk.totalClaims} claims</td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                      {new Date(chk.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedCheck(chk)}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors border border-indigo-500/20"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspection Modal */}
      {selectedCheck && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl border border-slate-800 shadow-2xl p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">
                  Verification Detail
                </span>
                <h3 className="text-lg font-bold text-white mt-1">
                  {selectedCheck.question}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCheck(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Full AI Answer Evaluated:
              </span>
              <p className="text-sm text-slate-200 leading-relaxed italic">
                "{selectedCheck.answer}"
              </p>
            </div>

            <ClaimBreakdown
              claims={selectedCheck.claims}
              overallVerdict={selectedCheck.overallVerdict}
              reliabilityScore={selectedCheck.reliabilityScore}
            />

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedCheck(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
