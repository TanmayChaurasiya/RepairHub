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
  Car,
  Mail,
  History,
  ShieldCheck,
  Coffee,
  CheckCircle,
  ShieldAlert,
  Radio,
  UserCheck,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { StatusBadge } from '../../components/common/StatusBadge';
import { CardSkeleton } from '../../components/common/LoadingSkeleton';
import { api } from '../../lib/api';
import { formatINR, formatDate } from '../../lib/utils';
import { getSocket } from '../../lib/socket';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [analyticsData, adminStatsData] = await Promise.all([
        api.get<any>('/analytics/dashboard').catch(() => null),
        api.get<{ stats: any }>('/admin/dashboard/stats').catch(() => null),
      ]);
      setStats(analyticsData);
      if (adminStatsData?.stats) {
        setAdminStats(adminStatsData.stats);
      }
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

    const onMechanicAvailabilityUpdated = () => {
      fetchStats();
    };

    socket.on('request:updated', onRequestUpdated);
    socket.on('mechanic:availability_updated', onMechanicAvailabilityUpdated);

    return () => {
      socket.off('request:updated', onRequestUpdated);
      socket.off('mechanic:availability_updated', onMechanicAvailabilityUpdated);
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
              Kanpur Garages Overview &amp; Dispatch
            </h1>
            <p className="text-xs text-slate-300">
              Real-time technician availability, smart reassignments, automated vehicle onboarding alerts, and verified payments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/admin/vehicles"
              className="px-4 py-2.5 rounded-xl bg-navy-800 hover:bg-navy-700 text-white text-xs font-bold border border-navy-700 flex items-center gap-2 transition-all"
            >
              <Car className="w-4 h-4 text-brand-cyan" /> Customer Vehicles
            </Link>
            <Link
              href="/admin/assignment-history"
              className="px-4 py-2.5 rounded-xl bg-navy-800 hover:bg-navy-700 text-white text-xs font-bold border border-navy-700 flex items-center gap-2 transition-all"
            >
              <History className="w-4 h-4 text-brand-orange" /> Assignment History
            </Link>
            <Link
              href="/admin/requests"
              className="px-5 py-2.5 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-extrabold shadow-lg shadow-brand-orange/25 flex items-center gap-2 transition-all"
            >
              <Wrench className="w-4 h-4" /> Manage Repairs
            </Link>
          </div>
        </div>

        {/* Real-time Statistics Cards */}
        {loading && !stats && !adminStats ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Registered Vehicles & Category breakdown */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Car className="w-5 h-5" />
                </div>
                <Link
                  href="/admin/vehicles"
                  className="text-[11px] font-bold text-brand-orange hover:underline flex items-center gap-0.5"
                >
                  View All &rarr;
                </Link>
              </div>
              <div>
                <span className="text-2xl font-black text-navy-900 block">
                  {adminStats?.vehicles?.total || 0}
                </span>
                <p className="text-xs text-slate-500 font-semibold">Registered Vehicles</p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-medium">
                <span>🚗 {adminStats?.vehicles?.byCategory?.CAR || 0} Cars</span>
                <span>🛵 {adminStats?.vehicles?.byCategory?.TWO_WHEELER || 0} 2W</span>
                <span>🚚 {adminStats?.vehicles?.byCategory?.COMMERCIAL || 0} Com</span>
              </div>
            </div>

            {/* Real-time Mechanic Workforce Availability */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <Link
                  href="/admin/mechanics"
                  className="text-[11px] font-bold text-brand-orange hover:underline flex items-center gap-0.5"
                >
                  Roster &rarr;
                </Link>
              </div>
              <div>
                <span className="text-2xl font-black text-navy-900 block">
                  {adminStats?.mechanics?.available || 0} / {adminStats?.mechanics?.total || 0}
                </span>
                <p className="text-xs text-slate-500 font-semibold">Technicians Available Now</p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {adminStats?.mechanics?.available || 0} Free
                </span>
                <span className="text-amber-700 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {adminStats?.mechanics?.busy || 0} Busy
                </span>
                <span className="text-slate-500 font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  {adminStats?.mechanics?.offline || 0} Off
                </span>
              </div>
            </div>

            {/* Automated Vehicle Emails Delivery */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <Link
                  href="/admin/email-notifications"
                  className="text-[11px] font-bold text-brand-orange hover:underline flex items-center gap-0.5"
                >
                  Logs &rarr;
                </Link>
              </div>
              <div>
                <span className="text-2xl font-black text-navy-900 block">
                  {adminStats?.emails?.sent || 0} / {adminStats?.emails?.total || 0}
                </span>
                <p className="text-xs text-slate-500 font-semibold">Emails Dispatched ({adminStats?.emails?.deliveryRate || 100}%)</p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                <span className="text-emerald-600 font-bold">
                  &#10003; {adminStats?.emails?.sent || 0} Sent
                </span>
                {adminStats?.emails?.failed > 0 ? (
                  <span className="text-rose-600 font-bold">
                    &times; {adminStats?.emails?.failed} Failed
                  </span>
                ) : (
                  <span className="text-slate-400">0 Failed</span>
                )}
                <span>{adminStats?.emails?.pending || 0} Pending</span>
              </div>
            </div>

            {/* Total Settled Revenue */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <IndianRupee className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Settled
                </span>
              </div>
              <div>
                <span className="text-2xl font-black text-navy-900 block">
                  {formatINR(adminStats?.revenue?.totalPaise || stats?.totalRevenuePaise || 0)}
                </span>
                <p className="text-xs text-slate-500 font-semibold">Total Revenue Collected</p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-medium">
                <span>Active Jobs: <strong>{adminStats?.assignments?.activeCount || 0}</strong></span>
                <span>Reassignable: <strong>{adminStats?.assignments?.reassignableCount || 0}</strong></span>
              </div>
            </div>

            {/* Total Registered Customers */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <Link
                  href="/admin/customers"
                  className="text-[11px] font-bold text-brand-orange hover:underline flex items-center gap-0.5"
                >
                  Accounts &rarr;
                </Link>
              </div>
              <div>
                <span className="text-2xl font-black text-navy-900 block">
                  {adminStats?.customers?.total || 0}
                </span>
                <p className="text-xs text-slate-500 font-semibold">Registered Customers</p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-medium">
                <span>Verified Client Profiles</span>
                <Link href="/admin/customers" className="text-brand-orange font-bold hover:underline">
                  View All &rarr;
                </Link>
              </div>
            </div>

            {/* Emergency Roadside Assistance (SOS) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <Link
                  href="/admin/emergency"
                  className="text-[11px] font-bold text-red-600 hover:underline flex items-center gap-0.5"
                >
                  Command &rarr;
                </Link>
              </div>
              <div>
                <span className="text-2xl font-black text-navy-900 block">
                  {adminStats?.emergency?.active || 0} <span className="text-sm font-semibold text-red-600">Active</span>
                </span>
                <p className="text-xs text-slate-500 font-semibold">Emergency Roadside SOS</p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-medium">
                <span>Total SOS: <strong>{adminStats?.emergency?.total || 0}</strong></span>
                <span className="text-emerald-600 font-bold">✓ {adminStats?.emergency?.completed || 0} Resolved</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Quick Shortcuts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/admin/garages"
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-brand-orange/40 hover:shadow-md transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-navy-50 text-navy-800 flex items-center justify-center mb-2 group-hover:bg-brand-orange group-hover:text-white transition-colors">
              <Building2 className="w-4 h-4" />
            </div>
            <p className="font-extrabold text-navy-900 text-xs">Workshops &amp; Garages</p>
            <p className="text-[11px] text-slate-500">Approvals &amp; profiles</p>
          </Link>

          <Link
            href="/admin/mechanics"
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-brand-orange/40 hover:shadow-md transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-navy-50 text-navy-800 flex items-center justify-center mb-2 group-hover:bg-brand-orange group-hover:text-white transition-colors">
              <Users className="w-4 h-4" />
            </div>
            <p className="font-extrabold text-navy-900 text-xs">Mechanic Workforce</p>
            <p className="text-[11px] text-slate-500">Live availability &amp; jobs</p>
          </Link>

          <Link
            href="/admin/vehicles"
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-brand-orange/40 hover:shadow-md transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-navy-50 text-navy-800 flex items-center justify-center mb-2 group-hover:bg-brand-orange group-hover:text-white transition-colors">
              <Car className="w-4 h-4" />
            </div>
            <p className="font-extrabold text-navy-900 text-xs">Customer Vehicles</p>
            <p className="text-[11px] text-slate-500">Fleet &amp; repair history</p>
          </Link>

          <Link
            href="/admin/assignment-history"
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-brand-orange/40 hover:shadow-md transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-navy-50 text-navy-800 flex items-center justify-center mb-2 group-hover:bg-brand-orange group-hover:text-white transition-colors">
              <History className="w-4 h-4" />
            </div>
            <p className="font-extrabold text-navy-900 text-xs">Reassignment Audit</p>
            <p className="text-[11px] text-slate-500">Allocation history</p>
          </Link>
        </div>

        {/* Requests by State Machine Stage */}
        {stats && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-navy-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-orange" />
              Active Repair Requests by State Machine Lifecycle
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'SUBMITTED', count: stats.statusCounts?.SUBMITTED || 0, color: 'text-blue-600' },
                { label: 'ASSIGNED', count: stats.statusCounts?.ASSIGNED || 0, color: 'text-indigo-600' },
                { label: 'INSPECTING', count: stats.statusCounts?.INSPECTING || 0, color: 'text-purple-600' },
                { label: 'ESTIMATE_SENT', count: stats.statusCounts?.ESTIMATE_SENT || 0, color: 'text-amber-600' },
                { label: 'IN_PROGRESS', count: stats.statusCounts?.IN_PROGRESS || 0, color: 'text-sky-600' },
                { label: 'PAID', count: stats.statusCounts?.PAID || 0, color: 'text-emerald-600' },
              ].map((s) => (
                <div key={s.label} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <span className={`text-xl font-black block ${s.color}`}>{s.count}</span>
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
