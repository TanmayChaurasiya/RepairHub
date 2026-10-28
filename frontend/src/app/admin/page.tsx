'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  IndianRupee,
  Users,
  Star,
  Wrench,
  AlertCircle,
  Building2,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { StatusBadge } from '../../components/common/StatusBadge';
import { CardSkeleton } from '../../components/common/LoadingSkeleton';
import { api } from '../../lib/api';
import { formatINR, formatDate } from '../../lib/utils';
import { getSocket } from '../../lib/socket';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await api.get<any>('/analytics/dashboard');
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    const socket = getSocket();
    if (!socket) return;

    const onRequestUpdated = () => {
      fetchStats();
    };

    socket.on('request:updated', onRequestUpdated);
    return () => {
      socket.off('request:updated', onRequestUpdated);
    };
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top Overview Banner */}
        <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-navy-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-orange/20 text-brand-orange text-xs font-bold border border-brand-orange/30">
              <Building2 className="w-3.5 h-3.5" /> Platform Command Center
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Kanpur Garages Overview & Dispatch
            </h1>
            <p className="text-xs text-slate-300">
              Supervise smart technician allocation, verified payments, bay workloads, and dispute resolutions.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/admin/requests"
              className="px-5 py-3 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-extrabold shadow-lg shadow-brand-orange/25 flex items-center gap-2 transition-all"
            >
              <Wrench className="w-4 h-4" /> Manage Requests
            </Link>
          </div>
        </div>

        {/* 4 Metric KPI Cards */}
        {loading || !stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Paid Revenue */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <IndianRupee className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xl font-black text-navy-900">
                  {formatINR(stats.totalRevenuePaise)}
                </span>
                <p className="text-xs text-slate-500 font-semibold">Total Revenue (Settled)</p>
              </div>
            </div>

            {/* Active Mechanics */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xl font-black text-navy-900">
                  {stats.activeMechanicsCount} / {stats.totalMechanicsCount}
                </span>
                <p className="text-xs text-slate-500 font-semibold">Active Mechanics Available</p>
              </div>
            </div>

            {/* Average Rating */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
                <Star className="w-6 h-6 fill-amber-500" />
              </div>
              <div>
                <span className="text-xl font-black text-navy-900">
                  {stats.averageMechanicRating.toFixed(1)} / 5.0
                </span>
                <p className="text-xs text-slate-500 font-semibold">Average Bay Rating</p>
              </div>
            </div>

            {/* Open Complaints */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xl font-black text-navy-900">
                  {stats.openComplaintsCount}
                </span>
                <p className="text-xs text-slate-500 font-semibold">Open Customer Tickets</p>
              </div>
            </div>
          </div>
        )}

        {/* Requests by Status Grid */}
        {stats && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-navy-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-orange" />
              Requests Breakdown by State Machine Stage
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'SUBMITTED', count: stats.statusCounts.SUBMITTED, color: 'text-blue-600' },
                { label: 'ASSIGNED', count: stats.statusCounts.ASSIGNED, color: 'text-indigo-600' },
                { label: 'INSPECTING', count: stats.statusCounts.INSPECTING, color: 'text-purple-600' },
                { label: 'ESTIMATE_SENT', count: stats.statusCounts.ESTIMATE_SENT, color: 'text-amber-600' },
                { label: 'IN_PROGRESS', count: stats.statusCounts.IN_PROGRESS, color: 'text-sky-600' },
                { label: 'PAID', count: stats.statusCounts.PAID, color: 'text-emerald-600' },
              ].map((s) => (
                <div key={s.label} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <span className={`text-xl font-black block ${s.color}`}>{s.count || 0}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Requests Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-navy-900 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-brand-cyan" />
              Recent Workshop Activity
            </h3>
            <Link
              href="/admin/requests"
              className="text-xs font-bold text-brand-orange hover:underline flex items-center gap-1"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Request #</th>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Mechanic</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats?.recentRequests?.map((req: any) => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-navy-900">
                      {req.requestNumber}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {req.vehicle?.make} {req.vehicle?.model} ({req.vehicle?.regNo})
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-600">
                      {req.category}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {req.customer?.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {req.mechanic?.name || <span className="text-amber-600 font-bold">Unassigned</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/admin/requests/${req.id}`}
                        className="text-xs font-bold text-brand-orange hover:underline flex items-center gap-1"
                      >
                        Inspect <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
