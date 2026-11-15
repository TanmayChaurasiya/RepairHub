'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  LogOut,
  MapPin,
  Calendar,
  Phone,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';

export default function GarageStatusPage() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();
  const [garage, setGarage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = async () => {
    try {
      setRefreshing(true);
      const res = await api.get<{ garage: any }>('/garage/profile');
      setGarage(res.garage);
      if (res.garage.status === 'APPROVED') {
        router.push('/garage');
      }
    } catch (err) {
      console.error('Failed to fetch garage status', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center text-slate-400 text-xs">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-brand-cyan" />
          Checking garage status...
        </div>
      </div>
    );
  }

  const currentStatus = garage?.status || user?.ownedGarage?.status || 'PENDING';

  return (
    <div className="min-h-screen bg-navy-950 py-12 px-4 sm:px-6 lg:px-8 selection:bg-brand-orange selection:text-white relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-brand-cyan/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-2xl mx-auto space-y-8 relative z-10">
        {/* Top Navbar */}
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-brand-cyan flex items-center justify-center text-navy-950 font-bold shadow-lg shadow-brand-cyan/20">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-base font-black text-white">
              Repair<span className="text-brand-orange">Hub</span>
            </span>
          </Link>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-navy-900 border border-navy-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-navy-800 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-400" />
            Sign Out
          </button>
        </div>

        {/* Status Card */}
        <div className="bg-navy-900 border border-navy-800 p-6 sm:p-10 shadow-2xl rounded-3xl space-y-8">
          {/* Header depending on status */}
          {currentStatus === 'PENDING' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto shadow-lg shadow-amber-500/10">
                <Clock className="w-8 h-8 animate-pulse" />
              </div>
              <div className="space-y-1">
                <span className="inline-block py-1 px-3 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-extrabold uppercase tracking-wider">
                  Status: Under Review
                </span>
                <h1 className="text-2xl font-black text-white">
                  Registration Awaiting Approval
                </h1>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Your garage application has been received and is currently being audited by the RepairHub Master Admin team.
                </p>
              </div>
            </div>
          )}

          {currentStatus === 'REJECTED' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
                <XCircle className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <span className="inline-block py-1 px-3 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] font-extrabold uppercase tracking-wider">
                  Status: Application Rejected
                </span>
                <h1 className="text-2xl font-black text-white">
                  Application Not Approved
                </h1>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Your workshop registration could not be verified by Master Admin at this time.
                </p>
              </div>

              {garage?.rejectionReason && (
                <div className="text-left p-4 rounded-xl bg-navy-950 border border-rose-500/30 text-xs space-y-1">
                  <span className="font-bold text-rose-400 block">Feedback from Master Admin:</span>
                  <p className="text-slate-300">{garage.rejectionReason}</p>
                </div>
              )}
            </div>
          )}

          {currentStatus === 'SUSPENDED' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <span className="inline-block py-1 px-3 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] font-extrabold uppercase tracking-wider">
                  Status: Suspended
                </span>
                <h1 className="text-2xl font-black text-white">
                  Workshop Account Suspended
                </h1>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Your garage account has been temporarily suspended by Master Admin. Please contact support.
                </p>
              </div>
            </div>
          )}

          {/* 3-Step Verification Timeline (for PENDING) */}
          {currentStatus === 'PENDING' && (
            <div className="p-4 sm:p-6 rounded-2xl bg-navy-950 border border-navy-800 space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Verification Progress
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">1. Application Submitted</h4>
                    <p className="text-[11px] text-slate-400">
                      Workshop profile, address, and credentials safely recorded.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 animate-spin" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-300">2. Master Admin Verification</h4>
                    <p className="text-[11px] text-slate-400">
                      Admin verifies workshop address, contact numbers, and service standards.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 opacity-50">
                  <div className="w-6 h-6 rounded-full bg-navy-800 text-slate-500 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-400">3. Dashboard & Mechanic Onboarding</h4>
                    <p className="text-[11px] text-slate-500">
                      Full access to invite mechanics and receive vehicle repair requests.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Garage Details Summary */}
          {garage && (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Application Summary
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-navy-950 border border-navy-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">Workshop Name</span>
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-brand-cyan" /> {garage.name}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-navy-950 border border-navy-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">Location</span>
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-brand-orange" /> {garage.city}, {garage.state || 'UP'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-navy-950 border border-navy-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">Registered Owner Email</span>
                  <span className="font-bold text-slate-200 flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> {user?.email || garage.owner?.email}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-navy-950 border border-navy-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">Submitted On</span>
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />{' '}
                    {new Date(garage.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-navy-800">
            <button
              onClick={fetchStatus}
              disabled={refreshing}
              className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-navy-800 hover:bg-navy-750 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh Status
            </button>

            <span className="text-[11px] text-slate-500 text-center sm:text-right">
              Questions? Reach us at <a href="mailto:support@repairhub.in" className="text-brand-cyan hover:underline">support@repairhub.in</a>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

