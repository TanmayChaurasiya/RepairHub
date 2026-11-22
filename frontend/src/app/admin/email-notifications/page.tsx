'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Mail,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Car,
  ChevronLeft,
  ChevronRight,
  Filter,
  ExternalLink,
} from 'lucide-react';
import { AppLayout } from '../../../components/layout/AppLayout';
import { CardSkeleton } from '../../../components/common/LoadingSkeleton';
import { api } from '../../../lib/api';
import { formatDate } from '../../../lib/utils';
import { useToast } from '../../../context/ToastContext';

interface EmailNotificationItem {
  id: string;
  recipient: string;
  subject: string;
  template: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  type: string;
  vehicleId: string | null;
  requestId: string | null;
  errorDetails: string | null;
  sentAt: string | null;
  createdAt: string;
  vehicle: {
    id: string;
    make: string;
    model: string;
    regNo: string;
    type: string;
  } | null;
  request: {
    id: string;
    requestNumber: string;
    status: string;
  } | null;
}

export default function AdminEmailNotificationsPage() {
  const [notifications, setNotifications] = useState<EmailNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalNotifications, setTotalNotifications] = useState(0);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const { success, error } = useToast();

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '15',
      });

      if (search.trim()) queryParams.set('search', search.trim());
      if (statusFilter !== 'ALL') queryParams.set('status', statusFilter);
      if (typeFilter !== 'ALL') queryParams.set('type', typeFilter);

      const res = await api.get<{
        notifications: EmailNotificationItem[];
        pagination: { total: number; totalPages: number };
      }>(`/admin/email-notifications?${queryParams.toString()}`);

      setNotifications(res.notifications);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalNotifications(res.pagination.total || 0);
    } catch (err: any) {
      error(err?.message || 'Failed to load email notifications log');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, typeFilter, error]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleRetry = async (id: string) => {
    try {
      setRetryingId(id);
      await api.post(`/admin/email-notifications/${id}/retry`, {});
      success('Notification re-sent successfully!');
      fetchNotifications();
    } catch (err: any) {
      error(err?.message || 'Failed to retry email delivery');
    } finally {
      setRetryingId(null);
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Delivered
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" /> Failed
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" /> Pending
          </span>
        );
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'VEHICLE_AVAILABILITY_AVAILABLE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Availability: Compatible
          </span>
        );
      case 'VEHICLE_AVAILABILITY_UNAVAILABLE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
            Availability: Occupied
          </span>
        );
      case 'MECHANIC_ASSIGNED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
            Technician Assigned
          </span>
        );
      case 'MECHANIC_REASSIGNED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
            Technician Reassigned
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
            {type}
          </span>
        );
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-navy-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-orange/20 text-brand-orange text-xs font-bold border border-brand-orange/30">
              <Mail className="w-3.5 h-3.5" /> Automated Email Dispatch Log
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Customer &amp; System Email Notifications ({totalNotifications})
            </h1>
            <p className="text-xs text-slate-300">
              Audit automated vehicle availability emails, technician assignment alerts, delivery states, and retry failed transmissions.
            </p>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search recipient, subject, reg no..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
            {['ALL', 'SENT', 'FAILED', 'PENDING'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-navy-900 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st === 'ALL' ? 'All Delivery Statuses' : st}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-4">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-navy-900">No Notifications Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No email transmissions match your selected filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3.5 px-4">Recipient</th>
                    <th className="py-3.5 px-4">Subject &amp; Notification Type</th>
                    <th className="py-3.5 px-4">Associated Vehicle / Request</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Dispatched At</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {notifications.map((notif) => (
                    <tr key={notif.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-4 font-mono font-bold text-navy-900">
                        {notif.recipient}
                      </td>

                      <td className="py-4 px-4 max-w-md">
                        <div className="space-y-1">
                          <p className="font-bold text-navy-900 line-clamp-1">{notif.subject}</p>
                          <div>{getTypeLabel(notif.type)}</div>
                          {notif.errorDetails && (
                            <p className="text-[11px] text-rose-600 font-mono bg-rose-50 p-1.5 rounded border border-rose-200 mt-1">
                              Error: {notif.errorDetails}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        {notif.vehicle ? (
                          <div className="flex items-center gap-2">
                            <Car className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="font-semibold text-navy-900">
                                {notif.vehicle.make} {notif.vehicle.model}
                              </p>
                              <span className="font-mono text-[10px] text-slate-500">
                                {notif.vehicle.regNo}
                              </span>
                            </div>
                          </div>
                        ) : notif.request ? (
                          <Link
                            href={`/admin/requests/${notif.request.id}`}
                            className="font-mono font-bold text-brand-orange hover:underline"
                          >
                            #{notif.request.requestNumber}
                          </Link>
                        ) : (
                          <span className="text-slate-400 italic">Platform System</span>
                        )}
                      </td>

                      <td className="py-4 px-4">{getStatusBadge(notif.status)}</td>

                      <td className="py-4 px-4 text-slate-500 whitespace-nowrap">
                        {formatDate(notif.sentAt || notif.createdAt)}
                      </td>

                      <td className="py-4 px-4 text-right">
                        {(notif.status === 'FAILED' || notif.status === 'PENDING') && (
                          <button
                            onClick={() => handleRetry(notif.id)}
                            disabled={retryingId === notif.id}
                            className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3 h-3 ${retryingId === notif.id ? 'animate-spin' : ''}`} />
                            {retryingId === notif.id ? 'Retrying...' : 'Retry'}
                          </button>
                        )}
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
                Page {page} of {totalPages} ({totalNotifications} total logged)
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
