'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Wrench,
  Car,
  FileText,
  Users,
  Settings,
  LogOut,
  Bell,
  Menu,
  X,
  LayoutDashboard,
  Building2,
  AlertCircle,
  CheckCircle2,
  PlusCircle,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../lib/socket';
import { InstallAppButton } from '../pwa/PWAInstallPrompt';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    if (socket.connected) setSocketConnected(true);

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-300">Loading RepairHub Platform...</p>
      </div>
    );
  }

  // Navigation Links tailored to Role
  let navItems: NavItem[] = [];

  if (user.role === 'CUSTOMER') {
    navItems = [
      { label: 'My Repairs', href: '/customer', icon: LayoutDashboard },
      { label: 'Book Repair', href: '/customer/new-request', icon: PlusCircle },
      { label: 'My Vehicles', href: '/customer/vehicles', icon: Car },
    ];
  } else if (user.role === 'MECHANIC') {
    navItems = [
      { label: 'Assigned Jobs', href: '/mechanic', icon: ClipboardList },
    ];
  } else if (user.role === 'GARAGE') {
    navItems = [
      { label: 'Overview', href: '/garage', icon: LayoutDashboard },
      { label: 'Bookings', href: '/garage/bookings', icon: ClipboardList },
      { label: 'Mechanic Team', href: '/garage/mechanics', icon: Users },
      { label: 'Garage Profile', href: '/garage/profile', icon: Building2 },
    ];
  } else if (user.role === 'ADMIN') {
    navItems = [
      { label: 'Overview', href: '/admin', icon: LayoutDashboard },
      { label: 'All Garages', href: '/admin/garages', icon: Building2 },
      { label: 'Mechanics', href: '/admin/mechanics', icon: Users },
      { label: 'All Repairs', href: '/admin/requests', icon: Wrench },
      { label: 'Audit Logs', href: '/admin/audit-logs', icon: FileText },
      { label: 'Complaints', href: '/admin/complaints', icon: AlertCircle },
    ];
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F8FAFC]">
      {/* Desktop Sidebar (Dark Navy #0B1729) */}
      <aside className="hidden md:flex flex-col w-64 bg-navy-900 text-white shrink-0 shadow-2xl border-r border-navy-800 z-30">
        {/* Brand Header */}
        <div className="p-6 border-b border-navy-800/80 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-orange to-amber-500 flex items-center justify-center text-white shadow-lg shadow-brand-orange/30 group-hover:scale-105 transition-transform">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-white block">
                Repair<span className="text-brand-orange">Hub</span>
              </span>
              <span className="text-[10px] font-semibold text-brand-cyan tracking-wider uppercase block truncate max-w-[140px]">
                {user.role === 'ADMIN'
                  ? 'Master Admin'
                  : user.role === 'GARAGE'
                  ? user.ownedGarage?.name || 'Garage Portal'
                  : user.mechanicProfile?.garage?.name || 'Kanpur Workshop'}
              </span>
            </div>
          </Link>
        </div>

        {/* Live Socket Status Pill */}
        <div className="px-6 py-2.5 bg-navy-950/60 border-b border-navy-800/40 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-medium">Real-time Sync</span>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                socketConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span className="text-[10px] font-semibold text-slate-300">
              {socketConnected ? 'Live' : 'Connecting'}
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-orange text-white shadow-md shadow-brand-orange/20 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-navy-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Card & Logout Footer */}
        <div className="p-4 border-t border-navy-800/80 bg-navy-950/40 space-y-3">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-9 h-9 rounded-xl bg-navy-800 border border-navy-700 flex items-center justify-center text-sm font-black text-brand-cyan">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-bold text-white truncate">{user.name}</p>
              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30">
                {user.role}
              </span>
            </div>
          </div>

          <InstallAppButton className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-brand-orange/15 hover:bg-brand-orange/25 text-brand-orange text-xs font-bold border border-brand-orange/30 transition-all" />

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-navy-800/60 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 text-xs font-semibold border border-navy-700/60 hover:border-rose-800/60 transition-all touch-target-min"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Top Header (with iOS notch safe-area padding) */}
      <header className="md:hidden bg-navy-900 text-white p-4 pt-[max(1rem,env(safe-area-inset-top))] flex items-center justify-between border-b border-navy-800 sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-orange flex items-center justify-center text-white">
            <Wrench className="w-4 h-4" />
          </div>
          <span className="text-base font-black tracking-tight">
            Repair<span className="text-brand-orange">Hub</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              socketConnected ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-navy-800 text-slate-300 hover:text-white touch-target-min flex items-center justify-center"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-navy-900 border-b border-navy-800 p-4 space-y-2 z-30 animate-slide-down">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium min-h-[44px] ${
                  isActive ? 'bg-brand-orange text-white font-bold' : 'text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}

          <div className="py-2 border-t border-navy-800/80">
            <InstallAppButton className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-brand-orange/20 text-brand-orange text-xs font-bold border border-brand-orange/30 transition-all min-h-[44px]" />
          </div>

          <div className="pt-2 border-t border-navy-800 flex items-center justify-between">
            <div className="text-xs text-slate-300">
              <p className="font-bold">{user.name}</p>
              <p className="text-[10px] text-brand-cyan">{user.role}</p>
            </div>
            <button
              onClick={logout}
              className="text-xs text-rose-400 font-semibold p-2 flex items-center gap-1.5 touch-target-min"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area (with iOS home-indicator safe-area bottom padding) */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}
