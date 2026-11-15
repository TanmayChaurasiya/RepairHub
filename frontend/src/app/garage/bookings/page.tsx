'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Wrench,
  Search,
  Filter,
  Calendar,
  User,
  Car,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { AppLayout } from '../../../components/layout/AppLayout';
import { api } from '../../../lib/api';
import { useToast } from '../../../context/ToastContext';

export default function GarageBookingsPage() {
  const { success, error: toastError } = useToast();

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Assign modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [mechanicsList, setMechanicsList] = useState<any[]>([]);
  const [selectedMechanicId, setSelectedMechanicId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (statusFilter !== 'ALL') query.set('status', statusFilter);
      if (searchQuery.trim()) query.set('search', searchQuery.trim());

      const res = await api.get<{ bookings: any[] }>(`/garage/bookings?${query.toString()}`);
      setBookings(res.bookings || []);
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  const fetchMechanics = async () => {
    try {
      const res = await api.get<{ mechanics: any[] }>('/garage/mechanics');
      setMechanicsList(res.mechanics.filter((m) => m.status === 'ACTIVE'));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [statusFilter]);

  useEffect(() => {
    fetchMechanics();
  }, []);

  const openAssign = (b: any) => {
    setSelectedBooking(b);
    setSelectedMechanicId(b.mechanic?.id || '');
    setAssignModalOpen(true);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMechanicId) return;

    setSubmitting(true);
    try {
      await api.post(`/garage/bookings/${selectedBooking.id}/assign`, {
        mechanicId: selectedMechanicId,
      });
      success('Mechanic assigned successfully!');
      setAssignModalOpen(false);
      fetchBookings();
    } catch (err: any) {
      toastError(err.message || 'Failed to assign mechanic');
    } finally {
      setSubmitting(false);
    }
  };

  const STATUS_TABS = [
    { id: 'ALL', label: 'All Bookings' },
    { id: 'SUBMITTED', label: 'Submitted' },
    { id: 'ASSIGNED', label: 'Assigned' },
    { id: 'INSPECTING', label: 'Inspecting' },
    { id: 'IN_PROGRESS', label: 'In Progress' },
    { id: 'COMPLETED', label: 'Completed' },
    { id: 'PAID', label: 'Paid' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Wrench className="w-6 h-6 text-brand-orange" />
              Garage Service Bookings
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Manage incoming repair requests, track job progression, and assign mechanics.
            </p>
          </div>

          <button
            onClick={fetchBookings}
            className="self-start sm:self-auto py-2 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" /> Refresh
          </button>
        </div>

        {/* Filters & Search */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Status Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === tab.id
                      ? 'bg-navy-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                fetchBookings();
              }}
              className="relative w-full sm:w-64"
            >
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search job card or vehicle..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-orange/40 focus:bg-white"
              />
            </form>
          </div>
        </div>

        {/* Bookings Table */}
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              <div className="w-6 h-6 border-2 border-brand-orange border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading garage bookings...
            </div>
          ) : bookings.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              No bookings matching the selected filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-3.5 px-4">Job Card</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Vehicle</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Assigned Mechanic</th>
                    <th className="py-3.5 px-4">Estimate / Bill</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bookings.map((b) => {
                    const latestEstimate = b.estimates?.[0];
                    return (
                      <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-slate-900 block">
                            {b.requestNumber}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(b.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-800 block">{b.customer?.name}</span>
                          <span className="text-[10px] text-slate-400">{b.customer?.phone}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-800 block">
                            {b.vehicle?.make} {b.vehicle?.model}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 uppercase">
                            {b.vehicle?.regNo}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="py-1 px-2 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {b.category}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="py-1 px-2.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20">
                            {b.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          {b.mechanic ? (
                            <span className="font-semibold text-slate-800 block">
                              {b.mechanic.name}
                            </span>
                          ) : (
                            <span className="text-amber-500 font-bold text-[10px] block">
                              Unassigned
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {latestEstimate ? (
                            <span className="font-bold text-slate-900 block">
                              ₹{(latestEstimate.totalPaise / 100).toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Pending inspect</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => openAssign(b)}
                            className="py-1 px-2.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-bold text-[11px] transition-colors"
                          >
                            {b.mechanic ? 'Reassign' : 'Assign'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Mechanic Assign Modal */}
      {assignModalOpen && selectedBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-navy-800 rounded-3xl p-6 max-w-md w-full text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-navy-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-brand-orange" /> Assign Workshop Mechanic
              </h3>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-navy-950 border border-navy-800 text-xs space-y-1">
              <p>Job Card: <span className="font-bold text-white">{selectedBooking.requestNumber}</span></p>
              <p>Vehicle: <span className="font-bold text-white">{selectedBooking.vehicle?.make} {selectedBooking.vehicle?.model} ({selectedBooking.vehicle?.regNo})</span></p>
              <p>Category: <span className="font-bold text-brand-cyan">{selectedBooking.category}</span></p>
            </div>

            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Select Workshop Mechanic
                </label>
                <select
                  required
                  value={selectedMechanicId}
                  onChange={(e) => setSelectedMechanicId(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                >
                  <option value="">-- Choose Mechanic --</option>
                  {mechanicsList.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name} ({m.skills?.join(', ') || 'General'}) — ★ {m.rating} ({m.activeJobCount || 0} active jobs)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="py-2 px-3 rounded-xl bg-navy-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedMechanicId}
                  className="py-2 px-4 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold disabled:opacity-50"
                >
                  {submitting ? 'Assigning...' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

