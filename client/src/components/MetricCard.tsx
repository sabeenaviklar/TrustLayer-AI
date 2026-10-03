import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  badge?: {
    text: string;
    type: 'positive' | 'negative' | 'neutral' | 'info';
  };
  accentColor?: string;
}

export function MetricCard({
  title,
  value,
  subtext,
  icon: Icon,
  badge,
  accentColor = 'indigo',
}: MetricCardProps) {
  const badgeStyles = {
    positive: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    negative: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    neutral: 'bg-slate-800 text-slate-400 border-slate-700',
    info: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  }[badge?.type || 'neutral'];

  const iconColors: Record<string, string> = {
    indigo: 'from-indigo-600/20 to-indigo-500/10 text-indigo-400 border-indigo-500/30',
    emerald: 'from-emerald-600/20 to-emerald-500/10 text-emerald-400 border-emerald-500/30',
    rose: 'from-rose-600/20 to-rose-500/10 text-rose-400 border-rose-500/30',
    amber: 'from-amber-600/20 to-amber-500/10 text-amber-400 border-amber-500/30',
  };

  return (
    <div className="glass-panel glass-panel-hover rounded-2xl p-5 border border-slate-800 relative overflow-hidden group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 tracking-wide uppercase">{title}</p>
          <h3 className="text-3xl font-extrabold text-white mt-1.5 tracking-tight group-hover:text-indigo-300 transition-colors">
            {value}
          </h3>
          {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
        </div>

        <div
          className={`w-11 h-11 rounded-xl bg-gradient-to-tr border flex items-center justify-center shadow-inner ${
            iconColors[accentColor] || iconColors.indigo
          }`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {badge && (
        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
          <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badgeStyles}`}>
            {badge.text}
          </span>
          <span className="text-[11px] text-slate-500">Live Metric</span>
        </div>
      )}
    </div>
  );
}
