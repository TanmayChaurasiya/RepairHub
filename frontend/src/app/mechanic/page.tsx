'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Wrench,
  Clock,
  Car,
  Star,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Filter,
  ShieldCheck,
  Coffee,
  PowerOff,
  Activity,
  X,
  ChevronDown,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { StatusBadge } from '../../components/common/StatusBadge';
import { CardSkeleton } from '../../components/common/LoadingSkeleton';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatINR, formatDate } from '../../lib/utils';
import { getSocket } from '../../lib/socket';

type MechanicAvailability = 'AVAILABLE' | 'BUSY' | 'ON_BREAK' | 'OFFLINE';

export default function MechanicDashboardPage() {
  const { user, refreshUser } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Real-time Availability States
  const [availability, setAvailability] = useState<MechanicAvailability>('AVAILABLE');
  const [breakReason, setBreakReason] = useState<string>('');
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [breakModalOpen, setBreakModalOpen] = useState(false);
  const [customBreakReason, setCustomBreakReason] = useState('');

  const { success, error } = useToast();

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const data = await api.get<{ requests: any[] }>('/requests');
      setRequests(data.requests);
      if (user?.mechanicProfile) {
        const currentAvail = (user.mechanicProfile.availability as MechanicAvailability) ||
          (user.mechanicProfile.available ? 'AVAILABLE' : 'OFFLINE');
        setAvailability(currentAvail);
        setBreakReason(user.mechanicProfile.breakReason || '');
      }
    } catch (err: any) {
      error('Failed to load mechanic jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();

    const socket = getSocket();
    if (!socket) return;

    const onRequestUpdated = (updated: any) => {
      setRequests((prev) => {
        const exists = prev.some((r) => r.id === updated.id);
        if (exists) {
          return prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r));
        } else if (updated.mechanicId === user?.id) {
          return [updated, ...prev];
        }
        return prev;
      });
    };

    const onAvailabilityUpdated = (data: any) => {
      if (data.mechanicId === user?.id) {
        setAvailability(data.availability);
        setBreakReason(data.breakReason || '');
        refreshUser();
      }
    };

    socket.on('request:updated', onRequestUpdated);
    socket.on('mechanic:availability_updated', onAvailabilityUpdated);

    return () => {
      socket.off('request:updated', onRequestUpdated);
      socket.off('mechanic:availability_updated', onAvailabilityUpdated);
    };
  }, [user]);

  const handleUpdateAvailability = async (
    targetAvailability: MechanicAvailability,
    reason?: string
  ) => {
    try {
      setUpdatingAvailability(true);
      await api.patch('/mechanics/availability', {
        availability: targetAvailability,
        breakReason: targetAvailability === 'ON_BREAK' ? (reason || 'Personal Break') : undefined,
      });

      setAvailability(targetAvailability);
      if (targetAvailability === 'ON_BREAK') {
        setBreakReason(reason || 'Personal Break');
      } else {
        setBreakReason('');
      }

      const statusLabels: Record<MechanicAvailability, string> = {
        AVAILABLE: 'Available (Ready for new jobs)',
        BUSY: 'Busy (Working on bay repairs)',
        ON_BREAK: `On Break (${reason || 'Break'})`,
        OFFLINE: 'Offline / Off-Duty',
      };

      success(`Availability updated: ${statusLabels[targetAvailability]}`);
      setBreakModalOpen(false);
      refreshUser();
    } catch (err: any) {
      error(err.message || 'Failed to update availability status');
    } finally {
      setUpdatingAvailability(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (statusFilter === 'ALL') return true;
    return r.status === statusFilter;
  });

  const activeCount = requests.filter(
    (r) => !['COMPLETED', 'PAID', 'CANCELLED'].includes(r.status)
  ).length;

  const availabilityConfig: Record<
    MechanicAvailability,
    { label: string; badgeClass: string; dotClass: string; icon: React.ReactNode }
  > = {
    AVAILABLE: {
      label: 'Available',
      badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      dotClass: 'bg-emerald-400',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
    },
    BUSY: {
      label: 'Busy',
      badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      dotClass: 'bg-amber-400',
      icon: <Activity className="w-3.5 h-3.5 text-amber-400" />,
    },
    ON_BREAK: {
      label: breakReason ? `On Break (${breakReason})` : 'On Break',
      badgeClass: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      dotClass: 'bg-cyan-400',
      icon: <Coffee className="w-3.5 h-3.5 text-cyan-400" />,
    },
    OFFLINE: {
      label: 'Offline / Off-Duty',
      badgeClass: 'bg-slate-700 text-slate-300 border-slate-600',
      dotClass: 'bg-slate-400',
      icon: <PowerOff className="w-3.5 h-3.5 text-slate-400" />,
    },
  };

  const currentConfig = availabilityConfig[availability] || availabilityConfig.AVAILABLE;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top Header Card */}
        <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-navy-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-cyan/20 text-brand-cyan text-xs font-bold border border-brand-cyan/30">
              <Wrench className="w-3.5 h-3.5" /> Certified Workshop Bay
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Mechanic Job Cards & Bay Queue
            </h1>
            <p className="text-xs text-slate-300">
              Review assigned vehicles, record diagnosis, build versioned estimates, and advance repair stages.
            </p>
          </div>

          {/* Real-time 4-State Availability Switcher */}
          <div className="bg-navy-900/90 p-4 sm:p-5 rounded-2xl border border-navy-800 space-y-3 shrink-0 lg:max-w-md w-full">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Real-time Availability Status
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${currentConfig.dotClass} animate-pulse`} />
                  <span className="text-xs font-black text-white">{currentConfig.label}</span>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentConfig.badgeClass}`}>
                Live
              </span>
            </div>

            {/* Quick Status Selectors */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
              <button
                type="button"
                disabled={updatingAvailability}
                onClick={() => handleUpdateAvailability('AVAILABLE')}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all border flex items-center justify-center gap-1 ${
                  availability === 'AVAILABLE'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                    : 'bg-navy-950 text-slate-400 border-navy-800 hover:text-white hover:bg-navy-800'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Available
              </button>

              <button
                type="button"
                disabled={updatingAvailability}
                onClick={() => handleUpdateAvailability('BUSY')}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all border flex items-center justify-center gap-1 ${
                  availability === 'BUSY'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                    : 'bg-navy-950 text-slate-400 border-navy-800 hover:text-white hover:bg-navy-800'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Busy
              </button>

              <button
                type="button"
                disabled={updatingAvailability}
                onClick={() => setBreakModalOpen(true)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all border flex items-center justify-center gap-1 ${
                  availability === 'ON_BREAK'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                    : 'bg-navy-950 text-slate-400 border-navy-800 hover:text-white hover:bg-navy-800'
                }`}
              >
                <Coffee className="w-3 h-3" />
                Break
              </button>

              <button
                type="button"
                disabled={updatingAvailability}
                onClick={() => handleUpdateAvailability('OFFLINE')}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all border flex items-center justify-center gap-1 ${
                  availability === 'OFFLINE'
                    ? 'bg-slate-700 text-white border-slate-600 shadow-sm'
                    : 'bg-navy-950 text-slate-400 border-navy-800 hover:text-white hover:bg-navy-800'
                }`}
              >
                <PowerOff className="w-3 h-3" />
                Offline
              </button>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-50 text-brand-orange flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-black text-navy-900">{activeCount}</span>
              <p className="text-xs text-slate-500 font-semibold">Active Jobs in Bay</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
              <Star className="w-6 h-6 fill-amber-500" />
            </div>
            <div>
              <span className="text-2xl font-black text-navy-900">
                {user?.mechanicProfile?.rating?.toFixed(1) || '5.0'}
              </span>
              <p className="text-xs text-slate-500 font-semibold">
                Customer Rating ({user?.mechanicProfile?.totalReviews || 0} reviews)
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-black text-navy-900">
                {requests.filter((r) => r.status === 'COMPLETED' || r.status === 'PAID').length}
              </span>
              <p className="text-xs text-slate-500 font-semibold">Total Repaired Vehicles</p>
            </div>
          </div>
        </div>

        {/* Status Filters Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {[
            { id: 'ALL', label: 'All Jobs' },
            { id: 'ASSIGNED', label: 'Assigned (New)' },
            { id: 'INSPECTING', label: 'Inspecting' },
            { id: 'ESTIMATE_SENT', label: 'Estimate Sent' },
            { id: 'APPROVED', label: 'Approved (Ready to Work)' },
            { id: 'IN_PROGRESS', label: 'In Progress' },
            { id: 'QC', label: 'Quality Check' },
            { id: 'COMPLETED', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Jobs List Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Wrench className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-navy-900">No Jobs Found</h3>
            <p className="text-xs text-slate-500">
              {statusFilter === 'ALL'
                ? 'You do not have any repair jobs assigned to your bay right now.'
                : `No jobs currently matching the ${statusFilter} filter.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredRequests.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-hover transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-500">
                      {job.requestNumber}
                    </span>
                    <StatusBadge status={job.status} />
                  </div>

                  <div>
                    <h3 className="text-base font-black text-navy-900">
                      {job.vehicle?.make || 'Vehicle'} {job.vehicle?.model || ''} ({job.vehicle?.year || ''})
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold">
                      Reg: <span className="font-mono text-navy-900 font-bold">{job.vehicle?.regNo || 'N/A'}</span> | Category: <span className="text-brand-orange font-bold">{job.category}</span>
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    "{job.description}"
                  </p>

                  {job.diagnosis && (
                    <div className="text-xs text-emerald-800 bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">
                      <strong>Diagnosis:</strong> {job.diagnosis}
                    </div>
                  )}

                  {job.estimates?.[0] && (
                    <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="text-slate-500 font-medium">
                        Estimate v{job.estimates[0].version} ({job.estimates[0].status}):
                      </span>
                      <span className="font-extrabold text-navy-900">
                        {formatINR(job.estimates[0].totalPaise)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Owner: {job.customer?.name}
                  </span>
                  <Link
                    href={`/mechanic/jobs/${job.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold shadow-md shadow-brand-orange/20 transition-all"
                  >
                    Open Job Card <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Break Reason Modal */}
      {breakModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-5 relative">
            <button
              onClick={() => setBreakModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700 text-xs font-bold border border-cyan-200">
                <Coffee className="w-3.5 h-3.5" /> Break Reason
              </div>
              <h3 className="text-lg font-black text-navy-900">Set Break Status</h3>
              <p className="text-xs text-slate-500">
                Let your garage owner and dispatch know why you are stepping away from the bay.
              </p>
            </div>

            {/* Quick Pills */}
            <div className="flex flex-wrap gap-2">
              {['Lunch Break', 'Parts Pickup', 'Short Rest', 'Personal Break'].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => handleUpdateAvailability('ON_BREAK', reason)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-brand-orange hover:text-white transition-colors"
                >
                  {reason}
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Or Type Custom Reason
              </label>
              <input
                type="text"
                value={customBreakReason}
                onChange={(e) => setCustomBreakReason(e.target.value)}
                placeholder="e.g. Workshop tooling inspection"
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-orange/40"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBreakModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!customBreakReason.trim()}
                onClick={() => handleUpdateAvailability('ON_BREAK', customBreakReason.trim())}
                className="px-4 py-2 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold disabled:opacity-50 transition-all"
              >
                Confirm Break
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
