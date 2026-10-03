'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldCheck,
  LayoutDashboard,
  Sparkles,
  FileText,
  History,
  Key,
  Users,
  ChevronDown,
  LogOut,
  Zap,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function Navbar() {
  const pathname = usePathname();
  const { user, workspace, workspaces, switchWorkspace, logout } = useAuth();
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/check', label: 'Verify AI', icon: Sparkles },
    { href: '/documents', label: 'Documents', icon: FileText },
    { href: '/history', label: 'History', icon: History },
    { href: '/api-keys', label: 'API Keys', icon: Key },
    { href: '/team', label: 'Team', icon: Users },
    { href: '/billing', label: 'Billing', icon: CreditCard },
  ];

  const usage = workspace?.usage;
  const usagePercentage = usage ? Math.min(100, Math.round((usage.checkCount / usage.limit) * 100)) : 0;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Workspace Switcher */}
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                TrustLayer
              </span>
            </Link>

            {/* Workspace Selector */}
            {workspace && (
              <div className="relative">
                <button
                  onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 transition-all"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="max-w-[130px] truncate">{workspace.name}</span>
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20">
                    {workspace.plan}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                </button>

                {wsDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Workspaces
                    </div>
                    {workspaces.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => {
                          switchWorkspace(w.id);
                          setWsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800/80 transition-colors ${
                          w.id === workspace.id ? 'text-indigo-400 font-semibold bg-indigo-500/5' : 'text-slate-300'
                        }`}
                      >
                        <span className="truncate">{w.name}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-500">{w.plan}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Action Items */}
          <div className="flex items-center gap-3">
            {/* Quota Progress */}
            {usage && (
              <Link
                href="/billing"
                className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs transition-all group"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                <div className="flex flex-col">
                  <div className="flex items-center justify-between text-[11px] gap-2">
                    <span className="text-slate-400 group-hover:text-slate-300">Usage</span>
                    <span className="font-semibold text-slate-200">
                      {usage.checkCount} / {usage.limit}
                    </span>
                  </div>
                  <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full rounded-full transition-all ${
                        usagePercentage > 90 ? 'bg-rose-500' : usagePercentage > 75 ? 'bg-amber-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${usagePercentage}%` }}
                    />
                  </div>
                </div>
              </Link>
            )}

            {/* Quick Upgrade Button if on Free tier */}
            {workspace?.plan === 'free' && (
              <Link
                href="/billing"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-indigo-500/20 hover:from-amber-500/30 hover:to-indigo-500/30 border border-amber-500/30 text-amber-300 text-xs font-semibold shadow-sm transition-all"
              >
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Upgrade</span>
              </Link>
            )}

            {/* User Profile & Logout */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-900 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-indigo-700 flex items-center justify-center font-bold text-xs text-white uppercase shadow-sm">
                  {user?.name ? user.name[0] : 'U'}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={logout}
                    className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
