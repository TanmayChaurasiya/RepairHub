'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Wrench,
  Search,
  Filter,
  ArrowRight,
  RefreshCw,
  Car,
  User,
  Clock,
} from 'lucide-react';
import { AppLayout } from '../../../components/layout/AppLayout';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { TableRowSkeleton } from '../../../components/common/LoadingSkeleton';
import { api } from '../../../lib/api';
import { formatDate, formatINR } from '../../../lib/utils';
import { getSocket } from '../../../lib/socket';

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);

      const data = await api.get<{ requests: any[] }>(`/requests?${params.toString()}`);
      setRequests(data.requests);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    const socket = getSocket();
    if (!socket) return;

    const onRequestUpdated = (updated: any) => {
      setRequests((prev) =>
        prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
      );
    };

    socket.on('request:updated', onRequestUpdated);
    return () => {
      socket.off('request:updated', onRequestUpdated);
    };
  }, [statusFilter, categoryFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRequests();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-brand-orange">
            Operations Dispatch
          </span>
          <h1 className="text-2xl font-black text-navy-900 tracking-tight">
            All Vehicle Repair Requests ({requests.length})
          </h1>
          <p className="text-xs text-slate-500">
            Real-time feed of incoming bookings, inspection cards, estimates, and completed jobs.
          </p>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <form onSubmit={handleSearch} className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by reg #, vehicle, request ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
            />
          </form>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto text-xs font-semibold rounded-xl border border-slate-300 py-2 px-3 bg-slate-50 text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">SUBMITTED (Unassigned)</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="INSPECTING">INSPECTING</option>
              <option value="ESTIMATE_SENT">ESTIMATE_SENT</option>
              <option value="APPROVED">APPROVED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="QC">QC</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="PAID">PAID</option>
              <option value="REJECTED">REJECTED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full sm:w-auto text-xs font-semibold rounded-xl border border-slate-300 py-2 px-3 bg-slate-50 text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
            >
              <option value="">All Categories</option>
              <option value="ENGINE">ENGINE</option>
              <option value="BRAKES">BRAKES</option>
              <option value="ELECTRICAL">ELECTRICAL</option>
              <option value="AC">AC</option>
              <option value="SUSPENSION">SUSPENSION</option>
              <option value="GENERAL_SERVICE">GENERAL_SERVICE</option>
              <option value="BODYWORK">BODYWORK</option>
            </select>

            <button
              onClick={fetchRequests}
              className="p-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-600 transition-colors shrink-0"
              title="Refresh List"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Requests Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Request ID</th>
                  <th className="py-3.5 px-4 sm:px-6">Vehicle</th>
                  <th className="py-3.5 px-4 sm:px-6">Category</th>
                  <th className="py-3.5 px-4 sm:px-6">Customer</th>
                  <th className="py-3.5 px-4 sm:px-6">Mechanic</th>
                  <th className="py-3.5 px-4 sm:px-6">Status</th>
                  <th className="py-3.5 px-4 sm:px-6">Estimate / Bill</th>
                  <th className="py-3.5 px-4 sm:px-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <>
                    <TableRowSkeleton />
                    <TableRowSkeleton />
                    <TableRowSkeleton />
                  </>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                      No repair requests found matching the current filters.
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 font-mono font-bold text-navy-900">
                        {req.requestNumber}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6">
                        <span className="font-bold text-navy-900 block">
                          {req.vehicle?.make || 'Vehicle'} {req.vehicle?.model || ''}
                        </span>
                        <span className="text-[11px] font-mono font-semibold text-slate-500">
                          {req.vehicle?.regNo || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6">
                        <span className="font-semibold text-slate-700">{req.category}</span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-slate-700">
                        {req.customer?.name}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6">
                        {req.mechanic ? (
                          <span className="font-medium text-navy-900">{req.mechanic.name}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 font-bold text-navy-900">
                        {req.estimates?.[0] ? formatINR(req.estimates[0].totalPaise) : '—'}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6">
                        <Link
                          href={`/admin/requests/${req.id}`}
                          className="px-3 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-bold text-xs inline-flex items-center gap-1 transition-colors"
                        >
                          Manage <ArrowRight className="w-3 h-3 text-brand-orange" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
