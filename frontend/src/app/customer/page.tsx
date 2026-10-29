'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Car,
  PlusCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  FileText,
  AlertCircle,
  Star,
  Wrench,
  CheckCircle2,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { StatusBadge } from '../../components/common/StatusBadge';
import { CardSkeleton } from '../../components/common/LoadingSkeleton';
import { api } from '../../lib/api';
import { formatINR, formatDate } from '../../lib/utils';
import { getSocket } from '../../lib/socket';

export default function CustomerDashboardPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqData, vehData] = await Promise.all([
        api.get<{ requests: any[] }>('/requests'),
        api.get<{ vehicles: any[] }>('/vehicles'),
      ]);
      setRequests(reqData.requests);
      setVehicles(vehData.vehicles);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Listen for live updates via Socket.IO
    const socket = getSocket();
    if (!socket) return;

    const onRequestUpdated = (updated: any) => {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === updated.id
            ? {
                ...r,
                ...updated,
                vehicle: updated.vehicle || r.vehicle,
                garage: updated.garage || r.garage,
                mechanic: updated.mechanic || r.mechanic,
                estimates: updated.estimates || r.estimates,
              }
            : r
        )
      );
    };

    socket.on('request:updated', onRequestUpdated);
    return () => {
      socket.off('request:updated', onRequestUpdated);
    };
  }, []);

  const activeRequests = requests.filter(
    (r) => r.status !== 'PAID' && r.status !== 'CANCELLED'
  );
  const completedHistory = requests.filter(
    (r) => r.status === 'PAID' || r.status === 'CANCELLED'
  );

  return (
    <AppLayout>
      {/* Top Banner / Welcome */}
      <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-navy-800 flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-orange/20 text-brand-orange text-xs font-bold border border-brand-orange/30">
            <Car className="w-3.5 h-3.5" /> Customer Garage Portal
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Vehicle Health & Active Repairs
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Track repairs in real-time, approve transparent estimates before work starts, and access digital invoices.
          </p>
        </div>

        <div className="z-10 flex items-center gap-3 shrink-0">
          <Link
            href="/customer/new-request"
            className="px-5 py-3 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-extrabold shadow-lg shadow-brand-orange/30 flex items-center gap-2 transition-all"
          >
            <PlusCircle className="w-4 h-4" /> Book Repair Service
          </Link>
        </div>
      </div>

      {/* Vehicles Overview Ribbon */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-navy-900 flex items-center gap-2">
            <Car className="w-4 h-4 text-brand-cyan" />
            Registered Vehicles ({vehicles.length})
          </h2>
          <Link
            href="/customer/vehicles"
            className="text-xs font-bold text-brand-orange hover:text-brand-orange-hover flex items-center gap-1"
          >
            Manage Garage <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50 space-y-2">
            <p className="text-xs text-slate-500">No vehicles registered yet.</p>
            <Link
              href="/customer/vehicles"
              className="inline-flex items-center gap-1 text-xs font-bold text-brand-orange hover:underline"
            >
              + Add your first vehicle
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map((v) => (
              <div
                key={v.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-brand-cyan/40 hover:shadow-hover transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-navy-900 text-white">
                    {v.regNo}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {v.type}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-navy-900">
                  {v.make} {v.model} ({v.year})
                </h3>
                <p className="text-xs text-slate-500">
                  Total Service Visits: {v._count?.requests || 0}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Service Requests */}
      <div className="space-y-4">
        <h2 className="text-base font-extrabold text-navy-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-brand-orange" />
          Live Repairs in Progress ({activeRequests.length})
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : activeRequests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-navy-900">All Vehicles Healthy</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You currently have no active repairs in the workshop. Everything is in running order!
            </p>
            <Link
              href="/customer/new-request"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-orange text-white text-xs font-bold hover:bg-brand-orange-hover transition-colors"
            >
              <PlusCircle className="w-4 h-4" /> Schedule Maintenance
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {activeRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-hover transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-500">
                      {req.requestNumber}
                    </span>
                    <StatusBadge status={req.status} />
                  </div>

                  <div>
                    <h3 className="text-base font-black text-navy-900">
                      {req.vehicle?.make || 'Vehicle'} {req.vehicle?.model || ''}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500">
                      Reg: {req.vehicle?.regNo || 'N/A'} | Category: <span className="text-brand-orange font-bold">{req.category}</span>
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    "{req.description}"
                  </p>

                  {/* Estimate Info if Available */}
                  {req.estimates && req.estimates[0] && (
                    <div className="flex items-center justify-between text-xs bg-orange-50/50 p-2.5 rounded-xl border border-orange-100">
                      <span className="font-semibold text-slate-700">Latest Estimate:</span>
                      <span className="font-extrabold text-brand-orange">
                        {formatINR(req.estimates[0].totalPaise)}
                      </span>
                    </div>
                  )}

                  {req.mechanic && (
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-1">
                      <Wrench className="w-3.5 h-3.5 text-brand-cyan" />
                      Assigned Mechanic: <strong className="text-navy-900">{req.mechanic.name || 'Assigned'}</strong>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Created: {formatDate(req.createdAt)}
                  </span>
                  <Link
                    href={`/customer/requests/${req.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold transition-all shadow-md shadow-navy-900/10"
                  >
                    View Timeline <ArrowRight className="w-3.5 h-3.5 text-brand-orange" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Service History */}
      {completedHistory.length > 0 && (
        <div className="space-y-4 pt-4">
          <h2 className="text-base font-extrabold text-navy-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Service History & Invoices ({completedHistory.length})
          </h2>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3.5 px-4 sm:px-6">Job ID</th>
                    <th className="py-3.5 px-4 sm:px-6">Vehicle</th>
                    <th className="py-3.5 px-4 sm:px-6">Category</th>
                    <th className="py-3.5 px-4 sm:px-6">Date</th>
                    <th className="py-3.5 px-4 sm:px-6">Total Paid</th>
                    <th className="py-3.5 px-4 sm:px-6">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {completedHistory.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 font-mono font-bold text-navy-900">
                        {req.requestNumber}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-700">
                        {req.vehicle?.make || 'Vehicle'} {req.vehicle?.model || ''} ({req.vehicle?.regNo || 'N/A'})
                      </td>
                      <td className="py-3.5 px-4 sm:px-6">
                        <span className="font-semibold text-slate-600">{req.category}</span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-slate-500">
                        {formatDate(req.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 font-extrabold text-navy-900">
                        {req.invoice ? formatINR(req.invoice.totalPaise) : '—'}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6">
                        <Link
                          href={`/customer/requests/${req.id}`}
                          className="text-xs font-bold text-brand-orange hover:underline flex items-center gap-1"
                        >
                          Invoice & Details <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
