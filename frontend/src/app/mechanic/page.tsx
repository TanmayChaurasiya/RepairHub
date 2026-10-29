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
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { StatusBadge } from '../../components/common/StatusBadge';
import { CardSkeleton } from '../../components/common/LoadingSkeleton';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatINR, formatDate } from '../../lib/utils';
import { getSocket } from '../../lib/socket';

export default function MechanicDashboardPage() {
  const { user, refreshUser } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [available, setAvailable] = useState(true);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  const { success, error } = useToast();

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const data = await api.get<{ requests: any[] }>('/requests');
      setRequests(data.requests);
      if (user?.mechanicProfile) {
        setAvailable(user.mechanicProfile.available);
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

    socket.on('request:updated', onRequestUpdated);
    return () => {
      socket.off('request:updated', onRequestUpdated);
    };
  }, [user]);

  const handleToggleAvailability = async () => {
    try {
      setTogglingAvailability(true);
      const nextStatus = !available;
      await api.patch('/mechanics/availability', { available: nextStatus });
      setAvailable(nextStatus);
      success(`Availability status updated: You are now ${nextStatus ? 'Available for new jobs' : 'Off-duty / Busy'}`);
      refreshUser();
    } catch (err: any) {
      error('Failed to update availability');
    } finally {
      setTogglingAvailability(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (statusFilter === 'ALL') return true;
    return r.status === statusFilter;
  });

  const activeCount = requests.filter(
    (r) => !['COMPLETED', 'PAID', 'CANCELLED'].includes(r.status)
  ).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top Header Card */}
        <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-navy-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
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

          {/* Availability Toggle Chip */}
          <div className="flex items-center gap-4 bg-navy-900/90 p-4 rounded-2xl border border-navy-800 shrink-0">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Job Dispatch Status
              </span>
              <span className={`text-xs font-bold ${available ? 'text-emerald-400' : 'text-amber-400'}`}>
                {available ? '● Available for Assignment' : '○ Busy / Off-Duty'}
              </span>
            </div>
            <button
              disabled={togglingAvailability}
              onClick={handleToggleAvailability}
              className={`p-2 rounded-xl border transition-all ${
                available
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {available ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
            </button>
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
    </AppLayout>
  );
}
