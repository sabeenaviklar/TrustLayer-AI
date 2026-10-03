import React from 'react';
import { CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';

interface VerdictBadgeProps {
  verdict: 'SUPPORTED' | 'CONTRADICTED' | 'UNVERIFIABLE' | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function VerdictBadge({ verdict, size = 'md', showIcon = true }: VerdictBadgeProps) {
  const v = verdict?.toUpperCase() || 'UNVERIFIABLE';

  let config = {
    bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    icon: HelpCircle,
    label: 'UNVERIFIABLE',
  };

  if (v === 'SUPPORTED') {
    config = {
      bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      icon: CheckCircle2,
      label: 'SUPPORTED',
    };
  } else if (v === 'CONTRADICTED') {
    config = {
      bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      icon: AlertTriangle,
      label: 'CONTRADICTED',
    };
  }

  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs font-semibold px-2.5 py-1 gap-1.5',
    lg: 'text-sm font-semibold px-3 py-1.5 gap-2',
  }[size];

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border transition-colors ${config.bg} ${sizeClasses}`}
    >
      {showIcon && <Icon className={iconSizes} />}
      <span>{config.label}</span>
    </span>
  );
}
