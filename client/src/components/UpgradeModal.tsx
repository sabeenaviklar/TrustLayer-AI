'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  Zap,
  CheckCircle2,
  X,
  CreditCard,
  ShieldCheck,
  Loader2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function UpgradeModal({ isOpen, onClose, onSuccess }: UpgradeModalProps) {
  const { workspace, user, refreshWorkspace } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mockOrder, setMockOrder] = useState<any>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleStartUpgrade = async () => {
    if (!workspace) return;
    setLoading(true);
    setError(null);
    setMockOrder(null);

    try {
      const order = await api.post<any>(`/v1/workspaces/${workspace.id}/billing/create-order`, {});

      if (order.isMock) {
        // Open mock payment simulator in-modal
        setMockOrder(order);
        setLoading(false);
        return;
      }

      // Live Razorpay script loading
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Could not load Razorpay SDK. Please check your internet connection.');
      }

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'TrustLayer AI',
        description: 'TrustLayer Pro Plan Subscription (5,000 checks/mo)',
        order_id: order.id,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },
        theme: {
          color: '#6366f1',
        },
        handler: async (response: any) => {
          try {
            setLoading(true);
            await api.post(`/v1/workspaces/${workspace.id}/billing/verify-payment`, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            await refreshWorkspace();
            setSuccess(true);
            if (onSuccess) onSuccess();
          } catch (err: any) {
            setError(err.message || 'Payment verification failed');
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (err: any) {
      setError(err.message || 'Failed to initiate upgrade');
    } finally {
      if (!mockOrder) {
        setLoading(false);
      }
    }
  };

  const handleSimulatePayment = async () => {
    if (!workspace || !mockOrder) return;
    setLoading(true);
    setError(null);

    try {
      await api.post(`/v1/workspaces/${workspace.id}/billing/verify-payment`, {
        razorpayOrderId: mockOrder.id,
        razorpayPaymentId: `pay_mock_${Date.now()}`,
        razorpaySignature: 'mock_signature_approved',
      });

      await refreshWorkspace();
      setSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to complete mock payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-8 overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">Upgrade Successful!</h3>
            <p className="text-sm text-slate-300 max-w-sm mx-auto">
              Your workspace has been upgraded to <strong className="text-white">TrustLayer Pro</strong>. Your quota is now 5,000 checks per month.
            </p>
            <div className="pt-4">
              <button
                onClick={onClose}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        ) : mockOrder ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Razorpay Sandbox Simulator</h3>
                <p className="text-xs text-slate-400">Mock test mode is active</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Order ID:</span>
                <span className="font-mono text-slate-200">{mockOrder.id}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Amount:</span>
                <span className="font-semibold text-white">₹3,999 INR ($49 USD)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Item:</span>
                <span className="text-slate-200">TrustLayer Pro Plan (1 Month)</span>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {error}
              </div>
            )}

            <button
              onClick={handleSimulatePayment}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Activating Pro Plan...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Simulate Payment & Activate Pro</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Enterprise Grade AI Grounding</span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Upgrade to Pro</h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Unlock high-volume verification pipelines, priority DeBERTa-v3 inference, and multi-team collaboration.
              </p>
            </div>

            {/* Price Badge */}
            <div className="p-4 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-baseline justify-between">
              <div>
                <span className="text-3xl font-black text-white">₹3,999</span>
                <span className="text-xs text-slate-400 ml-1.5">/ month (~$49 USD)</span>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                Cancel anytime
              </span>
            </div>

            {/* Feature List */}
            <div className="space-y-2.5">
              {[
                '5,000 checks / month (vs. 100 on Free)',
                'Sentence-level DeBERTa-v3 NLI inference',
                'Dedicated ChromaDB collection namespace',
                'Unlimited PDF and text document ingestion',
                'API Keys for automated CI/CD pipelines',
                'Multi-user team access & role management',
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {error}
              </div>
            )}

            <button
              onClick={handleStartUpgrade}
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Order...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>Upgrade to Pro Now</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as any).Razorpay) return resolve(true);

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
