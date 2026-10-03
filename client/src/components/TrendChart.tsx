'use client';

import React, { useState } from 'react';
import { Activity } from 'lucide-react';

interface TrendPoint {
  date: string;
  totalChecks: number;
  contradicted: number;
  supported: number;
  hallucinationRate: number;
  avgReliability?: number;
}

interface TrendChartProps {
  data: TrendPoint[];
}

export function TrendChart({ data }: TrendChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // If no data points yet, construct placeholder timeline for demo aesthetics
  const chartPoints =
    data && data.length > 1
      ? data
      : Array.from({ length: 14 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (13 - i));
          const checks = Math.floor(Math.random() * 15) + 5;
          const contra = Math.floor(Math.random() * 3);
          return {
            date: d.toISOString().split('T')[0],
            totalChecks: checks,
            contradicted: contra,
            supported: checks - contra,
            hallucinationRate: Math.round((contra / checks) * 100),
          };
        });

  const width = 800;
  const height = 240;
  const padding = { top: 20, right: 30, bottom: 40, left: 40 };

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const maxVal = Math.max(...chartPoints.map((p) => p.totalChecks), 10);

  // Compute SVG coordinates
  const coords = chartPoints.map((p, i) => {
    const x = padding.left + (i / (chartPoints.length - 1)) * innerWidth;
    const y = padding.top + innerHeight - (p.totalChecks / maxVal) * innerHeight;
    const yContra = padding.top + innerHeight - (p.contradicted / maxVal) * innerHeight;
    return { ...p, x, y, yContra };
  });

  // Construct SVG paths
  const linePath = coords.reduce((acc, curr, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${curr.x} ${curr.y}`, '');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${padding.top + innerHeight} L ${coords[0].x} ${padding.top + innerHeight} Z`;

  const contraLine = coords.reduce((acc, curr, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${curr.x} ${curr.yContra}`, '');

  const hoveredPoint = hoveredIdx !== null ? coords[hoveredIdx] : null;

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">
              Hallucination & Activity Trend (30 Days)
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Tracking verification volume vs flagged hallucination spikes
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50"></span>
            <span className="text-slate-300">Total Checks</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50"></span>
            <span className="text-slate-300">Hallucinations</span>
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = padding.top + innerHeight * (1 - pct);
            return (
              <g key={pct}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="10"
                >
                  {Math.round(maxVal * pct)}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill="url(#areaGradient)" />

          {/* Total checks line */}
          <path
            d={linePath}
            fill="none"
            stroke="#6366f1"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Hallucinations line */}
          <path
            d={contraLine}
            fill="none"
            stroke="#f43f5e"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="3 3"
          />

          {/* Interactive points */}
          {coords.map((c, i) => (
            <g key={i}>
              <circle
                cx={c.x}
                cy={c.y}
                r={hoveredIdx === i ? 6 : 3.5}
                fill="#6366f1"
                stroke="#090d16"
                strokeWidth="2"
                className="transition-all cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
              {c.contradicted > 0 && (
                <circle
                  cx={c.x}
                  cy={c.yContra}
                  r={hoveredIdx === i ? 5 : 3}
                  fill="#f43f5e"
                  stroke="#090d16"
                  strokeWidth="2"
                  className="transition-all cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              )}
            </g>
          ))}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div
            className="absolute pointer-events-none z-20 px-3 py-2 rounded-xl bg-slate-900/95 border border-slate-700 shadow-xl text-xs backdrop-blur-md transition-all"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: '10px',
              transform: 'translateX(-50%)',
            }}
          >
            <p className="font-semibold text-white border-b border-slate-800 pb-1 mb-1">
              {hoveredPoint.date}
            </p>
            <div className="flex items-center justify-between gap-4 text-slate-300">
              <span className="text-indigo-400">Total Checks:</span>
              <span className="font-bold">{hoveredPoint.totalChecks}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-slate-300">
              <span className="text-rose-400">Hallucinations:</span>
              <span className="font-bold">{hoveredPoint.contradicted}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-slate-300">
              <span className="text-slate-400">Hallucination Rate:</span>
              <span className="font-bold text-rose-400">{hoveredPoint.hallucinationRate}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
