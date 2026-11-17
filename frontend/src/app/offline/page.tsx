'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { WifiOff, RefreshCw, Wrench, PhoneCall, ShieldAlert } from 'lucide-react';

export default function OfflinePage() {
  const [isChecking, setIsChecking] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : false);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    setIsChecking(true);
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }, 600);
  };

  return (
    <div className="min-h-screen bg-navy-950 text-white flex flex-col items-center justify-center p-4 selection:bg-brand-orange selection:text-white">
      <div className="max-w-md w-full bg-navy-900 border border-navy-800 rounded-3xl p-6 sm:p-8 text-center shadow-2xl shadow-black/60 relative overflow-hidden">
        {/* Subtle Background Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand-orange/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-brand-cyan/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Icon Emblem */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-orange to-amber-500 flex items-center justify-center text-white shadow-xl shadow-brand-orange/30 mb-6">
          <Wrench className="w-8 h-8" />
        </div>

        {/* Offline Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold mb-4 uppercase tracking-wider">
          <WifiOff className="w-3.5 h-3.5" />
          Offline Mode
        </div>

        <h1 className="text-2xl font-black text-white tracking-tight mb-3">
          No Internet Connection
        </h1>

        <p className="text-sm text-slate-300 leading-relaxed mb-6">
          RepairHub requires an active network connection to synchronize live repair statuses, transparent estimates, and vehicle diagnostic reports securely.
        </p>

        {isOnline && (
          <div className="mb-6 p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-2xl text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Connection restored! Click below to reconnect.
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleRetry}
            disabled={isChecking}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-brand-orange to-brand-orange-hover hover:brightness-110 active:scale-[0.98] text-white font-bold text-sm shadow-lg shadow-brand-orange/25 transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Checking Connection...' : 'Reconnect & Retry'}
          </button>

          <Link
            href="/login"
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-navy-800/80 hover:bg-navy-800 text-slate-300 hover:text-white font-semibold text-xs border border-navy-700/60 transition-all"
          >
            Return to Login Screen
          </Link>
        </div>

        {/* Emergency Assistance Footer */}
        <div className="mt-8 pt-6 border-t border-navy-800/80 text-left">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Urgent Vehicle Breakdown?
          </p>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <PhoneCall className="w-3.5 h-3.5 text-brand-orange" /> Pilot Workshop Helpline
            </span>
            <span className="font-bold text-white font-mono">0512-2589000</span>
          </div>
        </div>
      </div>
    </div>
  );
}
