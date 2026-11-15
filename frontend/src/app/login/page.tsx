'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Wrench, Lock, Mail, ArrowRight, Shield, Building2, User as UserIcon, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

type ActiveRoleTab = 'CUSTOMER' | 'GARAGE' | 'MECHANIC' | 'ADMIN';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<ActiveRoleTab>('CUSTOMER');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { login, user } = useAuth();
  const router = useRouter();
  const { success } = useToast();

  useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN') {
        router.push('/admin');
      } else if (user.role === 'GARAGE') {
        if (user.ownedGarage && user.ownedGarage.status !== 'APPROVED') {
          router.push('/garage/status');
        } else {
          router.push('/garage');
        }
      } else if (user.role === 'MECHANIC') {
        router.push('/mechanic');
      } else {
        router.push('/customer');
      }
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSubmitting(true);

    try {
      const loggedUser = await login(email.trim(), password, selectedRole);
      success(`Welcome back, ${loggedUser.name}!`);

      if (loggedUser.role === 'ADMIN') {
        router.push('/admin');
      } else if (loggedUser.role === 'GARAGE') {
        if (loggedUser.ownedGarage && loggedUser.ownedGarage.status !== 'APPROVED') {
          router.push('/garage/status');
        } else {
          router.push('/garage');
        }
      } else if (loggedUser.role === 'MECHANIC') {
        router.push('/mechanic');
      } else {
        router.push('/customer');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const roleMeta: Record<ActiveRoleTab, { label: string; badge: string; color: string }> = {
    CUSTOMER: {
      label: 'Customer Portal',
      badge: 'Vehicle Owners',
      color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/20',
    },
    GARAGE: {
      label: 'Garage Owner Portal',
      badge: 'Workshop Management',
      color: 'text-brand-cyan border-brand-cyan/40 bg-brand-cyan/20',
    },
    MECHANIC: {
      label: 'Technician Portal',
      badge: 'Workshop Workforce',
      color: 'text-brand-orange border-brand-orange/40 bg-brand-orange/20',
    },
    ADMIN: {
      label: 'Master Admin Portal',
      badge: 'Platform Administration',
      color: 'text-rose-400 border-rose-500/40 bg-rose-500/20',
    },
  };

  return (
    <div className="bg-navy-900 border border-navy-800 py-8 px-6 sm:px-10 shadow-2xl rounded-3xl space-y-6">
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Role Portal Selector */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
          Select Your Login Portal
        </span>
        <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-navy-950/80 border border-navy-800">
          <button
            type="button"
            onClick={() => {
              setSelectedRole('CUSTOMER');
              setErrorMessage('');
            }}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-bold transition-all ${
              selectedRole === 'CUSTOMER'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-navy-850'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5 mb-1 text-emerald-400" />
            <span>Customer</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedRole('GARAGE');
              setErrorMessage('');
            }}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-bold transition-all ${
              selectedRole === 'GARAGE'
                ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-navy-850'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 mb-1 text-brand-cyan" />
            <span>Garage</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedRole('MECHANIC');
              setErrorMessage('');
            }}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-bold transition-all ${
              selectedRole === 'MECHANIC'
                ? 'bg-brand-orange/20 text-brand-orange border border-brand-orange/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-navy-850'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 mb-1 text-brand-orange" />
            <span>Mechanic</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedRole('ADMIN');
              setErrorMessage('');
            }}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-bold transition-all ${
              selectedRole === 'ADMIN'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-navy-850'
            }`}
          >
            <Shield className="w-3.5 h-3.5 mb-1 text-rose-400" />
            <span>Admin</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
          <span>Active Portal: <strong className="text-white">{roleMeta[selectedRole].label}</strong></span>
          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${roleMeta[selectedRole].color}`}>
            {roleMeta[selectedRole].badge}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1.5">
            Registered Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[11px] font-semibold text-brand-cyan hover:underline transition-colors"
            >
              Forgot Password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 px-4 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-extrabold shadow-lg shadow-brand-orange/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Verifying Credentials...
            </span>
          ) : (
            <>
              Sign In to {selectedRole === 'ADMIN' ? 'Admin Console' : selectedRole === 'GARAGE' ? 'Garage Portal' : selectedRole === 'MECHANIC' ? 'Workforce Portal' : 'Customer Portal'} <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="text-center pt-2 space-y-2 border-t border-navy-800">
        <p className="text-xs text-slate-400">
          Want to register your workshop?{' '}
          <Link href="/garage/register" className="font-bold text-brand-cyan hover:underline">
            Register New Garage
          </Link>
        </p>
        <p className="text-xs text-slate-400">
          Need vehicle repair?{' '}
          <Link href="/register" className="font-bold text-brand-orange hover:underline">
            Register as Customer
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-navy-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 px-4 selection:bg-brand-orange selection:text-white relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-cyan/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3 relative z-10">
        <Link href="/" className="inline-flex items-center gap-2.5 group">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-orange to-amber-500 flex items-center justify-center text-white shadow-xl shadow-brand-orange/30 group-hover:scale-105 transition-transform">
            <Wrench className="w-6 h-6" />
          </div>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Sign In to Repair<span className="text-brand-orange">Hub</span>
        </h1>
        <p className="text-xs text-slate-400">
          Multi-Garage Management Platform & Vehicle Repair Network
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Suspense
          fallback={
            <div className="bg-navy-900 border border-navy-800 py-8 px-6 sm:px-10 shadow-2xl rounded-3xl text-center text-slate-400 text-xs">
              Loading login portal...
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
