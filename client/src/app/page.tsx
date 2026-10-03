'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Key,
  Layers,
  Activity,
  Zap,
  Quote,
  Check,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden flex flex-col">
      {/* Background radial gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-indigo-600/20 via-indigo-900/10 to-transparent blur-3xl pointer-events-none -z-10"></div>
      <div className="absolute top-[800px] right-[-150px] w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div className="absolute top-[1400px] left-[-150px] w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none -z-10"></div>

      {/* Navigation */}
      <nav className="border-b border-slate-800/80 backdrop-blur-xl sticky top-0 z-50 bg-slate-950/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              TrustLayer
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-900 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 flex items-center gap-1.5 transition-all hover:scale-105"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/60 border border-indigo-800/80 text-xs font-semibold text-indigo-300 mb-8 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
          <span>NLI Cross-Encoder Hallucination Detection Engine</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
          Eliminate AI Hallucinations. <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-indigo-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">
            Ground Truth in Source Documents.
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Upload reference policies, manuals, or contracts. TrustLayer extracts claims from AI answers,
          runs semantic retrieval, and scores factual grounding with highlighted evidence sentences.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-sm shadow-xl shadow-indigo-500/30 flex items-center justify-center gap-2 transition-all hover:scale-105 group"
          >
            <Sparkles className="w-4 h-4 text-indigo-200 group-hover:rotate-12 transition-transform" />
            <span>Start Free Verification</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/login"
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-semibold text-sm border border-slate-800 flex items-center justify-center gap-2 transition-all"
          >
            <span>Live Dashboard Demo</span>
          </Link>
        </div>
      </section>

      {/* Interactive Showcase Card */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full pb-24">
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl shadow-indigo-950/40 relative">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span className="text-xs text-slate-500 font-mono ml-2">trustlayer.ai/evaluator</span>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Live Evaluation Sample
            </span>
          </div>

          <div className="space-y-4">
            {/* Prompt */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 text-left">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Evaluated Question
              </span>
              <p className="text-sm font-semibold text-white">
                "Where is TrustLayer headquartered and what pricing tiers are offered?"
              </p>
            </div>

            {/* Split Claims Demo */}
            <div className="space-y-3 text-left">
              {/* Claim 1: Supported */}
              <div className="p-4 rounded-xl bg-emerald-950/15 border border-emerald-500/30">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-300">Claim 1</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" />
                    SUPPORTED (99.3%)
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-200">
                  "TrustLayer is headquartered in San Francisco, California."
                </p>
                <div className="mt-2.5 pt-2 border-t border-emerald-500/20 text-xs text-slate-300 italic flex items-center gap-1.5">
                  <Quote className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>Evidence: "The headquarters of TrustLayer is located in San Francisco, California."</span>
                </div>
              </div>

              {/* Claim 2: Contradicted / Hallucinated */}
              <div className="p-4 rounded-xl bg-rose-950/15 border border-rose-500/30">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-300">Claim 2 (Hallucinated by LLM)</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30">
                    <AlertTriangle className="w-3 h-3" />
                    CONTRADICTED (99.9%)
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-200">
                  "TrustLayer offers unlimited checks on the Free plan without any monthly cap."
                </p>
                <div className="mt-2.5 pt-2 border-t border-rose-500/20 text-xs text-slate-300 italic flex items-center gap-1.5">
                  <Quote className="w-3 h-3 text-rose-400 shrink-0" />
                  <span>Evidence: "TrustLayer offers two pricing plans: Free Plan with 100 checks per month..."</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-slate-800/80 w-full">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-black text-white tracking-tight">
            How TrustLayer Secures AI Reliability
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Built from first principles for production language model governance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel glass-panel-hover rounded-2xl p-6 border border-slate-800 text-left">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Claim-Level Decomposition</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Splits complex multi-sentence responses into testable atomic claims to detect subtle factual drift.
            </p>
          </div>

          <div className="glass-panel glass-panel-hover rounded-2xl p-6 border border-slate-800 text-left">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <Quote className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Source Evidence Extraction</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Pinpoints the exact supporting or contradicting sentence directly from ingested PDF or TXT reference files.
            </p>
          </div>

          <div className="glass-panel glass-panel-hover rounded-2xl p-6 border border-slate-800 text-left">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Hallucination Analytics</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tracks reliability scores, hallucination rates, and daily trendlines to alert teams of regression over time.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-slate-800/80 w-full text-center">
        <div className="mb-14">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
            Simple, Transparent Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-1">
            Choose the Right Plan for Your Team
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Start free with 100 checks every month. Upgrade as your verification throughput scales.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch max-w-3xl mx-auto">
          {/* Free Plan */}
          <div className="glass-panel rounded-3xl p-8 border border-slate-800 text-left flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Free Plan</h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  Starter
                </span>
              </div>
              <div className="flex items-baseline gap-1 my-4">
                <span className="text-4xl font-black text-white">$0</span>
                <span className="text-xs text-slate-500">/ month</span>
              </div>
              <p className="text-xs text-slate-400 mb-6">
                Ideal for prototypes, indie developers, and internal testing.
              </p>

              <ul className="space-y-3 text-xs text-slate-300 mb-8">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span><strong>100 checks</strong> per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Standard NLI inference engine</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Up to 10 reference documents</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Developer API key access</span>
                </li>
              </ul>
            </div>

            <Link
              href="/signup"
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs text-center transition-colors"
            >
              Get Started Free
            </Link>
          </div>

          {/* Pro Plan */}
          <div className="glass-panel rounded-3xl p-8 border border-indigo-500/50 bg-indigo-950/15 text-left flex flex-col justify-between relative shadow-2xl shadow-indigo-950/50">
            <div className="absolute -top-3 right-6 px-3 py-0.5 rounded-full bg-indigo-600 text-white font-bold text-[10px] uppercase tracking-wider shadow">
              Most Popular
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Pro Plan</h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Production
                </span>
              </div>
              <div className="flex items-baseline gap-1 my-4">
                <span className="text-4xl font-black text-white">$49</span>
                <span className="text-xs text-slate-400">/ month</span>
              </div>
              <p className="text-xs text-slate-400 mb-6">
                For scaling applications requiring continuous model verification.
              </p>

              <ul className="space-y-3 text-xs text-slate-300 mb-8">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-400" />
                  <span><strong>5,000 checks</strong> per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-400" />
                  <span>High-priority batch NLI inference</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-400" />
                  <span>Unlimited reference documents</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-400" />
                  <span>Multi-member workspaces & invites</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-400" />
                  <span>30-day hallucination trend analytics</span>
                </li>
              </ul>
            </div>

            <Link
              href="/signup"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs text-center shadow-lg shadow-indigo-500/30 transition-all hover:scale-105"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span className="font-bold text-slate-300">TrustLayer AI</span>
            <span>&copy; {new Date().getFullYear()} All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-slate-400">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-400">Terms</Link>
            <a href="https://github.com/sabeenaviklar/TrustLayer-AI" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 font-semibold">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
