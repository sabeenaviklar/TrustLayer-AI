import React from 'react';
import { Quote, Sparkles, AlertCircle, FileSearch } from 'lucide-react';
import { VerdictBadge } from './VerdictBadge';

export interface Claim {
  claim: string;
  verdict: 'SUPPORTED' | 'CONTRADICTED' | 'UNVERIFIABLE';
  confidence: number;
  evidenceSentence?: string | null;
  chunkId?: string | null;
  scores?: {
    entailment: number;
    contradiction: number;
    neutral: number;
  };
}

interface ClaimBreakdownProps {
  claims: Claim[];
  overallVerdict?: string;
  reliabilityScore?: number;
}

export function ClaimBreakdown({ claims, overallVerdict, reliabilityScore }: ClaimBreakdownProps) {
  if (!claims || claims.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {reliabilityScore !== undefined && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-black text-indigo-400 text-lg">
              {Math.round(reliabilityScore)}%
            </div>
            <div>
              <p className="text-xs text-slate-400">Truth & Grounding Score</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-bold text-white">Overall:</span>
                {overallVerdict && <VerdictBadge verdict={overallVerdict} size="sm" />}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>
              <strong className="text-white font-semibold">{claims.length}</strong> claims verified
            </span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {claims.map((c, idx) => {
          const isContra = c.verdict === 'CONTRADICTED';
          const isSupp = c.verdict === 'SUPPORTED';

          const cardBorder = isContra
            ? 'border-rose-500/40 bg-rose-950/10'
            : isSupp
            ? 'border-emerald-500/40 bg-emerald-950/10'
            : 'border-slate-800 bg-slate-900/40';

          return (
            <div
              key={idx}
              className={`rounded-xl border p-4.5 transition-all glass-panel ${cardBorder}`}
            >
              {/* Claim Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-800/60">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-[11px] font-bold text-slate-400 flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-semibold text-slate-300">Extracted AI Claim</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">
                    Confidence: <strong className="text-slate-200">{Math.round(c.confidence * 100)}%</strong>
                  </span>
                  <VerdictBadge verdict={c.verdict} size="sm" />
                </div>
              </div>

              {/* Claim Statement */}
              <p className="text-sm font-medium text-slate-100 mt-3 leading-relaxed">
                "{c.claim}"
              </p>

              {/* Supporting / Contradicting Evidence Sentence */}
              {c.evidenceSentence ? (
                <div className="mt-3.5 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 mb-1.5">
                    <Quote className="w-3.5 h-3.5" />
                    <span>Reference Evidence from Document:</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/80 border border-indigo-500/20 text-xs text-slate-200 italic leading-relaxed flex items-start gap-2.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></span>
                    <div>
                      <span className="bg-indigo-500/15 px-1 py-0.5 rounded text-indigo-200 font-medium">
                        "{c.evidenceSentence}"
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center gap-2 text-xs text-slate-500">
                  <FileSearch className="w-3.5 h-3.5 text-slate-600" />
                  <span>No direct supporting or contradicting evidence found in workspace documents.</span>
                </div>
              )}

              {/* Detailed NLI Scores Pill */}
              {c.scores && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800/40">
                  <span className="text-slate-500">NLI Dist:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-900/40">
                    Entailment: {Math.round(c.scores.entailment * 100)}%
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-950/40 text-rose-400 border border-rose-900/40">
                    Contradiction: {Math.round(c.scores.contradiction * 100)}%
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-900/40">
                    Neutral: {Math.round(c.scores.neutral * 100)}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
