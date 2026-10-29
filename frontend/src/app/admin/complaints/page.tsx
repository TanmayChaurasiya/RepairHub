'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Clock, MessageSquare, ArrowRight } from 'lucide-react';
import { AppLayout } from '../../../components/layout/AppLayout';
import { ResolveComplaintModal } from '../../../components/modals/ComplaintModal';
import { api } from '../../../lib/api';
import { formatDate } from '../../../lib/utils';
import { useToast } from '../../../context/ToastContext';

export default function AdminComplaintsPage() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);

  const { success, error } = useToast();

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const url = statusFilter ? `/complaints?status=${statusFilter}` : '/complaints';
      const data = await api.get<{ complaints: any[] }>(url);
      setComplaints(data.complaints);
    } catch (err: any) {
      error('Failed to load complaints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, [statusFilter]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-orange">
              Customer Support & Quality
            </span>
            <h1 className="text-2xl font-black text-navy-900 tracking-tight">
              Customer Complaints & Inquiries ({complaints.length})
            </h1>
            <p className="text-xs text-slate-500">
              Review customer service escalations, mediate with garage managers, and record official resolutions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {['', 'OPEN', 'RESOLVED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  statusFilter === st
                    ? 'bg-navy-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st === '' ? 'All Tickets' : st}
              </button>
            ))}
          </div>
        </div>

        {/* Complaints List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Status</th>
                  <th className="py-3.5 px-4 sm:px-6">Subject & Description</th>
                  <th className="py-3.5 px-4 sm:px-6">Customer</th>
                  <th className="py-3.5 px-4 sm:px-6">Job ID / Vehicle</th>
                  <th className="py-3.5 px-4 sm:px-6">Date Raised</th>
                  <th className="py-3.5 px-4 sm:px-6">Resolution</th>
                  <th className="py-3.5 px-4 sm:px-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Loading complaints...
                    </td>
                  </tr>
                ) : complaints.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No complaints found.
                    </td>
                  </tr>
                ) : (
                  complaints.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            c.status === 'RESOLVED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {c.status === 'RESOLVED' ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                          )}
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 max-w-xs">
                        <span className="font-bold text-navy-900 block truncate">{c.subject}</span>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                          {c.description}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6">
                        <span className="font-semibold text-navy-900 block">{c.customer?.name || 'Customer'}</span>
                        <span className="text-[11px] text-slate-400">{c.customer?.phone || 'N/A'}</span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6">
                        <Link
                          href={`/admin/requests/${c.requestId}`}
                          className="font-mono font-bold text-brand-orange hover:underline block"
                        >
                          {c.request?.requestNumber || 'REQ'}
                        </Link>
                        <span className="text-[11px] text-slate-500">
                          {c.request?.vehicle?.make || 'Vehicle'} {c.request?.vehicle?.model || ''}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-slate-500">
                        {formatDate(c.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 max-w-xs">
                        {c.resolutionNote ? (
                          <div className="text-[11px] text-emerald-800 bg-emerald-50/80 p-2 rounded-lg border border-emerald-200 line-clamp-2">
                            "{c.resolutionNote}"
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Pending resolution</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6">
                        {c.status === 'OPEN' ? (
                          <button
                            onClick={() => setSelectedComplaintId(c.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors"
                          >
                            Resolve Ticket
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 font-semibold">Resolved</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resolution Modal */}
        {selectedComplaintId && (
          <ResolveComplaintModal
            complaintId={selectedComplaintId}
            isOpen={!!selectedComplaintId}
            onClose={() => setSelectedComplaintId(null)}
            onResolved={() => {
              fetchComplaints();
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}
