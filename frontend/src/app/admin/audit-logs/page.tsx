'use client';

import React, { useEffect, useState } from 'react';
import { FileText, Shield, Search, RefreshCw, Filter, Clock } from 'lucide-react';
import { AppLayout } from '../../../components/layout/AppLayout';
import { api } from '../../../lib/api';
import { useToast } from '../../../context/ToastContext';

export default function AdminAuditLogsPage() {
  const { error: toastError } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (actionFilter) query.set('action', actionFilter);

      const res = await api.get<{ auditLogs: any[] }>(`/admin/audit-logs?${query.toString()}`);
      setLogs(res.auditLogs || []);
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [actionFilter]);

  const ACTION_OPTIONS = [
    { value: '', label: 'All Operations' },
    { value: 'GARAGE_REGISTERED', label: 'Garage Registered' },
    { value: 'GARAGE_APPROVED', label: 'Garage Approved' },
    { value: 'GARAGE_REJECTED', label: 'Garage Rejected' },
    { value: 'GARAGE_SUSPENDED', label: 'Garage Suspended' },
    { value: 'GARAGE_REACTIVATED', label: 'Garage Reactivated' },
    { value: 'MECHANIC_INVITED', label: 'Mechanic Invited' },
    { value: 'MECHANIC_INVITATION_ACCEPTED', label: 'Mechanic Joined' },
    { value: 'MECHANIC_ASSIGNED', label: 'Mechanic Assigned' },
    { value: 'MECHANIC_SUSPENDED_BY_ADMIN', label: 'Admin Suspended Mechanic' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-orange">
              Platform Integrity & Governance
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <FileText className="w-6 h-6 text-brand-cyan" />
              Platform System Audit Trail ({logs.length})
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Immutable log of garage applications, approvals, mechanic assignments, and admin overrides.
            </p>
          </div>

          <button
            onClick={fetchAuditLogs}
            className="self-start sm:self-auto py-2 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" /> Refresh Trail
          </button>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="py-1.5 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              <div className="w-6 h-6 border-2 border-brand-cyan border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading audit logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              No audit records matching filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Entity</th>
                    <th className="py-3 px-4">Details / Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(log.createdAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {log.actor?.name || 'System'}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="py-0.5 px-2 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                          {log.actorRole}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-brand-orange text-[11px]">
                        {log.action}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 font-semibold">
                        {log.targetEntity}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500 max-w-sm truncate">
                        {log.metadata ? JSON.stringify(log.metadata) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

