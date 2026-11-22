'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  History,
  Search,
  ArrowRight,
  User,
  Wrench,
  Car,
  Calendar,
  Building2,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { AppLayout } from '../../../components/layout/AppLayout';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { CardSkeleton } from '../../../components/common/LoadingSkeleton';
import { api } from '../../../lib/api';
import { formatDate } from '../../../lib/utils';
import { useToast } from '../../../context/ToastContext';

interface AssignmentHistoryItem {
  id: string;
  requestId: string;
  previousMechanicId: string | null;
  newMechanicId: string;
  assignedById: string;
  assignedByRole: string;
  reason: string;
  createdAt: string;
  request: {
    id: string;
    requestNumber: string;
    category: string;
    status: string;
    vehicle: {
      id: string;
      make: string;
      model: string;
      regNo: string;
      type: string;
    };
    garage: {
      id: string;
      name: string;
      city: string;
    };
    customer: {
      id: string;
      name: string;
      email: string;
    };
  };
  previousMechanic: {
    id: string;
    name: string;
    email: string;
    phone: string;
  } | null;
  newMechanic: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  assignedBy: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export default function AdminAssignmentHistoryPage() {
  const [histories, setHistories] = useState<AssignmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const { error } = useToast();

  const fetchHistories = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '15',
      });
      if (search.trim()) queryParams.set('search', search.trim());

      const res = await api.get<{
        histories: AssignmentHistoryItem[];
        pagination: { total: number; totalPages: number };
      }>(`/admin/assignment-history?${queryParams.toString()}`);

      setHistories(res.histories);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalRecords(res.pagination.total || 0);
    } catch (err: any) {
      error(err?.message || 'Failed to load assignment histories');
    } finally {
      setLoading(false);
    }
  }, [page, search, error]);

  useEffect(() => {
    fetchHistories();
  }, [fetchHistories]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-navy-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-orange/20 text-brand-orange text-xs font-bold border border-brand-orange/30">
              <History className="w-3.5 h-3.5" /> Technician Allocation Audit
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Mechanic Assignment &amp; Reassignment History ({totalRecords})
            </h1>
            <p className="text-xs text-slate-300">
              Immutable chronological record of all technician assignments, admin reassignments, workload rebalancing, and stated business reasons.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by request #, vehicle, mechanic, or reason..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange"
            />
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-4">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : histories.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <History className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-navy-900">No Assignment Records Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No technician assignments match your active search filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3.5 px-4">Booking / Request #</th>
                    <th className="py-3.5 px-4">Vehicle &amp; Customer</th>
                    <th className="py-3.5 px-4">Reassignment Flow</th>
                    <th className="py-3.5 px-4">Authorized By</th>
                    <th className="py-3.5 px-4">Reason / Notes</th>
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {histories.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-4 font-mono font-bold text-navy-900">
                        <div className="space-y-1">
                          <span>{item.request?.requestNumber}</span>
                          <div>
                            <StatusBadge status={item.request?.status} />
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div>
                          <p className="font-bold text-navy-900 flex items-center gap-1.5">
                            <Car className="w-3.5 h-3.5 text-slate-400" />
                            {item.request?.vehicle?.make} {item.request?.vehicle?.model}
                          </p>
                          <p className="text-[11px] font-mono text-slate-500">
                            {item.request?.vehicle?.regNo}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Customer: {item.request?.customer?.name}
                          </p>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-center min-w-[100px]">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">From</span>
                            <strong className="text-xs truncate block max-w-[110px]">
                              {item.previousMechanic?.name || 'Unassigned'}
                            </strong>
                          </div>

                          <ArrowRight className="w-4 h-4 text-brand-orange shrink-0" />

                          <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center min-w-[100px]">
                            <span className="text-[10px] uppercase font-bold text-emerald-600 block">To</span>
                            <strong className="text-xs truncate block max-w-[110px]">
                              {item.newMechanic?.name}
                            </strong>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div>
                          <p className="font-bold text-navy-900">{item.assignedBy?.name}</p>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-navy-100 text-navy-800">
                            {item.assignedByRole}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4 max-w-xs">
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <p className="text-xs text-slate-700 italic">
                            &ldquo;{item.reason}&rdquo;
                          </p>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-slate-500 whitespace-nowrap">
                        {formatDate(item.createdAt)}
                      </td>

                      <td className="py-4 px-4 text-right">
                        <Link
                          href={`/admin/requests/${item.requestId}`}
                          className="px-3 py-1.5 rounded-lg bg-navy-50 hover:bg-brand-orange hover:text-white text-navy-700 text-xs font-bold transition-all inline-flex items-center gap-1"
                        >
                          Inspect <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Page {page} of {totalPages} ({totalRecords} total entries)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-navy-900 hover:bg-slate-50 disabled:opacity-50 transition-all flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-navy-900 hover:bg-slate-50 disabled:opacity-50 transition-all flex items-center gap-1"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
