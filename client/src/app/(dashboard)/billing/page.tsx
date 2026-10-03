'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { UpgradeModal } from '@/components/UpgradeModal';
import {
  CreditCard,
  Zap,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  AlertCircle,
  Clock,
  ArrowUpRight,
} from 'lucide-react';

export default function BillingPage() {
  const { workspace, refreshWorkspace } = useAuth();
  const [billingData, setBillingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchBilling = async () => {
    if (!workspace) return;
    try {
      setLoading(true);
      const data = await api.get(`/v1/workspaces/${workspace.id}/billing`);
      setBillingData(data);
    } catch (err) {
      console.error('Failed to load billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, [workspace?.id]);

  const handleCancelSubscription = async () => {
    if (!workspace || !confirm('Are you sure you want to downgrade to the Free plan?')) return;
    setCancelling(true);
    try {
      await api.post(`/v1/workspaces/${workspace.id}/billing/cancel`, {});
      await refreshWorkspace();
      await fetchBilling();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  const usage = workspace?.usage || billingData?.usage;
  const isPro = workspace?.plan === 'pro';
  const usagePercentage = usage ? Math.min(100, Math.round((usage.checkCount / usage.limit) * 100)) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Subscription & Billing
          </h1>
        </div>
        <p className="text-sm text-slate-400 mt-1">
          Manage your plan, check usage quotas, and billing settings for {workspace?.name}.
        </p>
      </div>

      {/* Main Stats / Current Plan Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Plan Overview */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isPro
                    ? 'bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                    : 'bg-slate-900 border border-slate-800 text-slate-400'
                }`}
              >
                {isPro ? <Zap className="w-6 h-6 text-amber-300" /> : <ShieldCheck className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white capitalize">{workspace?.plan || 'Free'} Plan</h3>
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                      isPro
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    }`}
                  >
                    Active
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isPro
                    ? 'High-throughput verification with 5,000 checks/mo'
                    : 'Standard tier for development and testing'}
                </p>
              </div>
            </div>

            {!isPro ? (
              <button
                onClick={() => setUpgradeModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Upgrade to Pro</span>
              </button>
            ) : (
              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-all"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
              </button>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Monthly Usage Quota</span>
              <span className="font-semibold text-white">
                {usage?.checkCount || 0} / {usage?.limit || 100} checks
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full rounded-full transition-all ${
                  usagePercentage > 90 ? 'bg-rose-500' : usagePercentage > 75 ? 'bg-amber-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{Math.max(0, (usage?.limit || 100) - (usage?.checkCount || 0))} checks remaining</span>
              <span>Resets on the 1st of next month</span>
            </div>
          </div>
        </div>

        {/* Payment / Gateway Details Card */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-300 text-xs font-bold uppercase tracking-wider mb-3">
              <CreditCard className="w-4 h-4 text-indigo-400" />
              <span>Payment Gateway</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Payments are securely processed via <strong>Razorpay</strong>. In development or mock environments, sandbox testing is automatically active.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Mode:</span>
              <span className="font-mono text-emerald-400">
                {billingData?.isMockMode ? 'Sandbox / Mock' : 'Live Test'}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Currency:</span>
              <span className="text-slate-200">INR / USD</span>
            </div>
          </div>

          <button
            onClick={() => setUpgradeModalOpen(true)}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
          >
            <span>{isPro ? 'Manage Subscription' : 'View Upgrade Options'}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Plan Comparison Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-800/80">
          <h3 className="text-base font-bold text-white">Compare Plans</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Choose the plan that fits your verification and compliance throughput.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {/* Free Tier */}
          <div className="p-6 space-y-5">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Starter</span>
              <h4 className="text-2xl font-black text-white mt-1">Free Tier</h4>
              <p className="text-xs text-slate-400 mt-1">For hobbyists and early prototyping.</p>
              <div className="mt-4">
                <span className="text-3xl font-black text-white">₹0</span>
                <span className="text-xs text-slate-500 ml-1.5">forever</span>
              </div>
            </div>

            <div className="space-y-2.5">
              {[
                '100 verification checks / month',
                'Sentence-level claim extraction',
                'ChromaDB vector collection',
                'PDF and text document ingestion',
                'Community support',
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>

            {!isPro && (
              <div className="pt-2">
                <span className="block w-full py-2.5 text-center rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-400">
                  Current Plan
                </span>
              </div>
            )}
          </div>

          {/* Pro Tier */}
          <div className="p-6 space-y-5 bg-indigo-950/20 relative">
            <div className="absolute top-4 right-4">
              <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-bold uppercase tracking-wider">
                Recommended
              </span>
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Business</span>
              <h4 className="text-2xl font-black text-white mt-1">Pro Plan</h4>
              <p className="text-xs text-slate-400 mt-1">For teams deploying LLMs in production.</p>
              <div className="mt-4">
                <span className="text-3xl font-black text-white">₹3,999</span>
                <span className="text-xs text-slate-400 ml-1.5">/ month (~$49 USD)</span>
              </div>
            </div>

            <div className="space-y-2.5">
              {[
                '5,000 verification checks / month',
                'Priority DeBERTa-v3 NLI inference',
                'Dedicated ChromaDB isolated collection',
                'Unlimited documents & larger chunk sizes',
                'API Keys for automated pipelines & CI/CD',
                'Team member invitations & role management',
                'Priority email & webhook alerts',
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setUpgradeModalOpen(true)}
                disabled={isPro}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>{isPro ? 'Already on Pro' : 'Upgrade to Pro'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        onSuccess={() => {
          fetchBilling();
          refreshWorkspace();
        }}
      />
    </div>
  );
}
