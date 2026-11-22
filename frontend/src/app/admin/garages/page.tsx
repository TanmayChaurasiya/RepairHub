'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  X,
  AlertTriangle,
  RefreshCw,
  Search,
  User,
  Phone,
  MapPin,
  IndianRupee,
  Clock,
  Wrench,
  Users,
  ArrowRight,
  Mail,
  FileText,
  Activity,
} from 'lucide-react';
import { AppLayout } from '../../../components/layout/AppLayout';
import { api } from '../../../lib/api';
import { useToast } from '../../../context/ToastContext';
import { formatDate } from '../../../lib/utils';

export default function AdminGaragesPage() {
  const [garages, setGarages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Detail Drawer
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedGarage, setSelectedGarage] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [detailGarage, setDetailGarage] = useState<any>(null);
  const [detailAuditLogs, setDetailAuditLogs] = useState<any[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const handleOpenGarageDetail = async (id: string) => {
    try {
      setDrawerLoading(true);
      setDetailDrawerOpen(true);
      const res = await api.get<{ garage: any; auditLogs: any[] }>(`/admin/garages/${id}`);
      setDetailGarage(res.garage);
      setDetailAuditLogs(res.auditLogs || []);
    } catch (err: any) {
      error(err.message || 'Failed to load garage details');
    } finally {
      setDrawerLoading(false);
    }
  };

  // Create Form
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Kanpur');
  const [state, setState] = useState('Uttar Pradesh');
  const [phone, setPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [isVerified, setIsVerified] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { success, error } = useToast();

  const fetchGarages = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (statusFilter !== 'ALL') query.set('status', statusFilter);
      if (searchQuery.trim()) query.set('search', searchQuery.trim());

      const data = await api.get<{ garages: any[] }>(`/admin/garages?${query.toString()}`);
      setGarages(data.garages || []);
    } catch (err: any) {
      error(err.message || 'Failed to load garages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGarages();
  }, [statusFilter]);

  const handleApprove = async (id: string, gName: string) => {
    try {
      await api.post(`/admin/garages/${id}/approve`, {});
      success(`Garage "${gName}" has been approved!`);
      fetchGarages();
    } catch (err: any) {
      error(err.message || 'Failed to approve garage');
    }
  };

  const handleOpenReject = (g: any) => {
    setSelectedGarage(g);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  const submitReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGarage) return;

    try {
      await api.post(`/admin/garages/${selectedGarage.id}/reject`, {
        reason: rejectionReason.trim(),
      });
      success(`Garage "${selectedGarage.name}" rejected.`);
      setRejectModalOpen(false);
      fetchGarages();
    } catch (err: any) {
      error(err.message || 'Failed to reject garage');
    }
  };

  const handleSuspend = async (id: string, gName: string) => {
    if (!confirm(`Are you sure you want to suspend "${gName}"? Their dashboard will be locked.`)) return;

    try {
      await api.post(`/admin/garages/${id}/suspend`, { reason: 'Suspended by Master Admin' });
      success(`Garage "${gName}" suspended.`);
      fetchGarages();
    } catch (err: any) {
      error(err.message || 'Failed to suspend garage');
    }
  };

  const handleReactivate = async (id: string, gName: string) => {
    try {
      await api.post(`/admin/garages/${id}/reactivate`, {});
      success(`Garage "${gName}" reactivated successfully!`);
      fetchGarages();
    } catch (err: any) {
      error(err.message || 'Failed to reactivate garage');
    }
  };

  const handleCreateGarage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post('/garages', {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        phone: phone.trim(),
        ownerEmail: ownerEmail.trim() || undefined,
        isVerified,
      });

      success(`Garage "${name}" registered successfully!`);
      setCreateModalOpen(false);
      setName('');
      setAddress('');
      setPhone('');
      setOwnerEmail('');
      fetchGarages();
    } catch (err: any) {
      error(err.message || 'Failed to create garage');
    } finally {
      setSubmitting(false);
    }
  };

  const STATUS_TABS = [
    { id: 'ALL', label: 'All Garages' },
    { id: 'PENDING', label: 'Pending Approval' },
    { id: 'APPROVED', label: 'Approved' },
    { id: 'REJECTED', label: 'Rejected' },
    { id: 'SUSPENDED', label: 'Suspended' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-orange">
              Master Admin Control
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-brand-cyan" />
              Garage Lifecycle Management ({garages.length})
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Approve new workshop applications, audit owner credentials, and manage platform-wide garage operations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold shadow-md shadow-brand-orange/20 flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" /> Add Workshop
            </button>
            <button
              onClick={fetchGarages}
              className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              title="Refresh List"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
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

          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchGarages();
            }}
            className="relative w-full sm:w-64"
          >
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search garage, owner or city..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 focus:bg-white"
            />
          </form>
        </div>

        {/* Garages Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              <div className="w-6 h-6 border-2 border-brand-cyan border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading garage directory...
            </div>
          ) : garages.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              No garages found under this filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-3.5 px-4">Workshop</th>
                    <th className="py-3.5 px-4">Registered Owner</th>
                    <th className="py-3.5 px-4">Location</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Mechanics</th>
                    <th className="py-3.5 px-4">Bookings</th>
                    <th className="py-3.5 px-4">Revenue</th>
                    <th className="py-3.5 px-4 text-right">Master Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {garages.map((g) => (
                    <tr
                      key={g.id}
                      onClick={() => handleOpenGarageDetail(g.id)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 group-hover:text-brand-orange transition-colors block">
                          {g.name}
                        </span>
                        <span className="text-[10px] text-slate-400">{g.phone}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        {g.owner ? (
                          <>
                            <span className="font-semibold text-slate-800 block">{g.owner.name}</span>
                            <span className="text-[10px] text-slate-400">{g.owner.email}</span>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No linked owner</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-700 block">{g.city}</span>
                        <span className="text-[10px] text-slate-400 truncate max-w-xs block">
                          {g.address}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`py-1 px-2.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                            g.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                              : g.status === 'PENDING'
                              ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                              : g.status === 'SUSPENDED'
                              ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                              : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                          }`}
                        >
                          {g.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-700">
                        {g._count?.mechanics || 0}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-700">
                        {g._count?.requests || 0}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-emerald-600">
                        ₹{(g.metrics?.totalRevenueRupees || 0).toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {g.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleApprove(g.id, g.name)}
                                className="py-1 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleOpenReject(g)}
                                className="py-1 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[10px] transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {g.status === 'APPROVED' && (
                            <button
                              onClick={() => handleSuspend(g.id, g.name)}
                              className="py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-bold text-[10px] transition-colors"
                            >
                              Suspend
                            </button>
                          )}

                          {g.status === 'SUSPENDED' && (
                            <button
                              onClick={() => handleReactivate(g.id, g.name)}
                              className="py-1 px-2.5 rounded-lg bg-brand-cyan hover:bg-cyan-400 text-navy-950 font-bold text-[10px] transition-colors"
                            >
                              Reactivate
                            </button>
                          )}

                          {g.status === 'REJECTED' && (
                            <button
                              onClick={() => handleApprove(g.id, g.name)}
                              className="py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] transition-colors"
                            >
                              Re-Approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Reject Garage Modal */}
      {rejectModalOpen && selectedGarage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Reject Garage Registration
              </h3>
              <button
                onClick={() => setRejectModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Provide feedback for <strong>{selectedGarage.name}</strong> ({selectedGarage.owner?.email || 'No email'}). An automated email notification will be dispatched to the owner.
            </p>

            <form onSubmit={submitReject} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Reason for Rejection *
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Workshop address could not be verified, or phone number unreachable."
                  className="w-full p-3 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Garage Profile Detail Drawer */}
      {detailDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden">
            {/* Drawer Header */}
            <div className="p-6 bg-navy-950 text-white flex items-center justify-between border-b border-navy-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center text-white">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">
                      {detailGarage?.name || 'Workshop Profile'}
                    </h2>
                    {detailGarage?.isVerified && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300">
                    {detailGarage?.city}, {detailGarage?.state || 'Uttar Pradesh'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailDrawerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-navy-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            {drawerLoading || !detailGarage ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <div className="w-6 h-6 border-2 border-brand-orange border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading workshop profile...
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Live Operating Status & Availability */}
                {(() => {
                  const availableMechCount = (detailGarage.mechanics || []).filter(
                    (m: any) => m.availability === 'AVAILABLE' && m.status === 'ACTIVE'
                  ).length;
                  const totalMechCount = (detailGarage.mechanics || []).length;
                  const isApproved = detailGarage.status === 'APPROVED';

                  return (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Workshop Real-Time Availability
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              !isApproved
                                ? 'bg-slate-400'
                                : availableMechCount > 0
                                ? 'bg-emerald-500 animate-pulse'
                                : 'bg-amber-500'
                            }`}
                          />
                          <p className="text-xs font-bold text-navy-900">
                            {!isApproved
                              ? 'Workshop Inactive / Under Review'
                              : availableMechCount > 0
                              ? `Open & Accepting Repairs (${availableMechCount} technician${availableMechCount > 1 ? 's' : ''} on duty)`
                              : 'Workshop Busy (All mechanics occupied / on break)'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right sm:text-right">
                        <span className="text-[10px] text-slate-500 block">Operating Hours:</span>
                        <span className="text-xs font-mono font-bold text-navy-900">
                          {detailGarage.operatingHours || '08:00 AM - 08:00 PM'}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Owner Information Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4 text-brand-orange" />
                    Workshop Owner &amp; Contact Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Owner Name:</span>
                      <strong className="text-navy-900">{detailGarage.owner?.name || 'Unassigned'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Email Address:</span>
                      <strong className="text-navy-900 font-mono">{detailGarage.owner?.email || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Owner Phone:</span>
                      <strong className="text-navy-900 font-mono">{detailGarage.owner?.phone || detailGarage.phone}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Workshop Helpline:</span>
                      <strong className="text-navy-900 font-mono">{detailGarage.phone}</strong>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-400 block text-[11px]">Physical Workshop Address:</span>
                      <p className="text-navy-900 font-medium">
                        {detailGarage.address}, {detailGarage.city}, {detailGarage.state || 'UP'} {detailGarage.pinCode ? `- ${detailGarage.pinCode}` : ''}
                      </p>
                    </div>
                    {detailGarage.description && (
                      <div className="sm:col-span-2">
                        <span className="text-slate-400 block text-[11px]">Description:</span>
                        <p className="text-slate-700 italic">{detailGarage.description}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Services Offered */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-brand-cyan" />
                    Supported Automotive Services ({detailGarage.services?.length || 0})
                  </h3>
                  {detailGarage.services && detailGarage.services.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {detailGarage.services.map((srv: string) => (
                        <span
                          key={srv}
                          className="px-2.5 py-1 rounded-lg bg-navy-50 text-navy-800 text-[11px] font-bold border border-navy-100"
                        >
                          {srv}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No specific service tags configured.</p>
                  )}
                </div>

                {/* Mechanics Team Roster */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-brand-orange" />
                    Technicians Working at this Bay ({detailGarage.mechanics?.length || 0})
                  </h3>
                  {detailGarage.mechanics && detailGarage.mechanics.length > 0 ? (
                    <div className="space-y-2">
                      {detailGarage.mechanics.map((m: any) => (
                        <div
                          key={m.id}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <p className="font-bold text-navy-900">{m.user?.name}</p>
                            <p className="text-[11px] text-slate-500 font-mono">{m.user?.email}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {m.specialization || 'General Technician'} &bull; {m.experienceYears}y exp
                            </p>
                          </div>
                          <div className="text-right space-y-1">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                m.availability === 'AVAILABLE'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : m.availability === 'BUSY'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : m.availability === 'ON_BREAK'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {m.availability || (m.available ? 'AVAILABLE' : 'OFFLINE')}
                            </span>
                            <span className="block text-[10px] text-slate-400 font-bold">
                              ★ {m.rating.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No mechanics assigned to this garage yet.</p>
                  )}
                </div>

                {/* Audit History Log */}
                {detailAuditLogs && detailAuditLogs.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                    <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      Administrative Audit Trail
                    </h3>
                    <div className="space-y-2">
                      {detailAuditLogs.slice(0, 5).map((log: any) => (
                        <div key={log.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                          <div className="flex items-center justify-between text-[11px]">
                            <strong className="text-navy-900 font-mono">{log.action}</strong>
                            <span className="text-slate-400">{formatDate(log.createdAt)}</span>
                          </div>
                          <p className="text-slate-600 text-[11px] mt-0.5">
                            By {log.actor?.name} ({log.actorRole})
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Create Garage Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-orange" />
                Register New Workshop Bay
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGarage} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">
                    Garage / Workshop Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Royal Auto Care"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-orange/40 focus:bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="45 Civil Lines"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-orange/40 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Kanpur"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-orange/40 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0512-2345678"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-orange/40 focus:bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">
                    Owner Email (Optional account link)
                  </label>
                  <input
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="owner@royalgarage.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-orange/40 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="py-2 px-3 rounded-xl bg-slate-100 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="py-2 px-4 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white font-bold disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Save Workshop'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Garage Profile Detail Drawer */}
      {detailDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden">
            {/* Drawer Header */}
            <div className="p-6 bg-navy-950 text-white flex items-center justify-between border-b border-navy-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center text-white">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">
                      {detailGarage?.name || 'Workshop Profile'}
                    </h2>
                    {detailGarage?.isVerified && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300">
                    {detailGarage?.city}, {detailGarage?.state || 'Uttar Pradesh'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailDrawerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-navy-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            {drawerLoading || !detailGarage ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <div className="w-6 h-6 border-2 border-brand-orange border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading workshop profile...
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Live Operating Status & Availability */}
                {(() => {
                  const availableMechCount = (detailGarage.mechanics || []).filter(
                    (m: any) => m.availability === 'AVAILABLE' && m.status === 'ACTIVE'
                  ).length;
                  const totalMechCount = (detailGarage.mechanics || []).length;
                  const isApproved = detailGarage.status === 'APPROVED';

                  return (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Workshop Real-Time Availability
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              !isApproved
                                ? 'bg-slate-400'
                                : availableMechCount > 0
                                ? 'bg-emerald-500 animate-pulse'
                                : 'bg-amber-500'
                            }`}
                          />
                          <p className="text-xs font-bold text-navy-900">
                            {!isApproved
                              ? 'Workshop Inactive / Under Review'
                              : availableMechCount > 0
                              ? `Open & Accepting Repairs (${availableMechCount} technician${availableMechCount > 1 ? 's' : ''} on duty)`
                              : 'Workshop Busy (All mechanics occupied / on break)'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right sm:text-right">
                        <span className="text-[10px] text-slate-500 block">Operating Hours:</span>
                        <span className="text-xs font-mono font-bold text-navy-900">
                          {detailGarage.operatingHours || '08:00 AM - 08:00 PM'}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Owner Information Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4 text-brand-orange" />
                    Workshop Owner &amp; Contact Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Owner Name:</span>
                      <strong className="text-navy-900">{detailGarage.owner?.name || 'Unassigned'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Email Address:</span>
                      <strong className="text-navy-900 font-mono">{detailGarage.owner?.email || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Owner Phone:</span>
                      <strong className="text-navy-900 font-mono">{detailGarage.owner?.phone || detailGarage.phone}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Workshop Helpline:</span>
                      <strong className="text-navy-900 font-mono">{detailGarage.phone}</strong>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-400 block text-[11px]">Physical Workshop Address:</span>
                      <p className="text-navy-900 font-medium">
                        {detailGarage.address}, {detailGarage.city}, {detailGarage.state || 'UP'} {detailGarage.pinCode ? `- ${detailGarage.pinCode}` : ''}
                      </p>
                    </div>
                    {detailGarage.description && (
                      <div className="sm:col-span-2">
                        <span className="text-slate-400 block text-[11px]">Description:</span>
                        <p className="text-slate-700 italic">{detailGarage.description}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Services Offered */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-brand-cyan" />
                    Supported Automotive Services ({detailGarage.services?.length || 0})
                  </h3>
                  {detailGarage.services && detailGarage.services.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {detailGarage.services.map((srv: string) => (
                        <span
                          key={srv}
                          className="px-2.5 py-1 rounded-lg bg-navy-50 text-navy-800 text-[11px] font-bold border border-navy-100"
                        >
                          {srv}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No specific service tags configured.</p>
                  )}
                </div>

                {/* Mechanics Team Roster */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-brand-orange" />
                    Technicians Working at this Bay ({detailGarage.mechanics?.length || 0})
                  </h3>
                  {detailGarage.mechanics && detailGarage.mechanics.length > 0 ? (
                    <div className="space-y-2">
                      {detailGarage.mechanics.map((m: any) => (
                        <div
                          key={m.id}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <p className="font-bold text-navy-900">{m.user?.name}</p>
                            <p className="text-[11px] text-slate-500 font-mono">{m.user?.email}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {m.specialization || 'General Technician'} &bull; {m.experienceYears}y exp
                            </p>
                          </div>
                          <div className="text-right space-y-1">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                m.availability === 'AVAILABLE'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : m.availability === 'BUSY'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : m.availability === 'ON_BREAK'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {m.availability || (m.available ? 'AVAILABLE' : 'OFFLINE')}
                            </span>
                            <span className="block text-[10px] text-slate-400 font-bold">
                              ★ {m.rating.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No mechanics assigned to this garage yet.</p>
                  )}
                </div>

                {/* Audit History Log */}
                {detailAuditLogs && detailAuditLogs.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                    <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      Administrative Audit Trail
                    </h3>
                    <div className="space-y-2">
                      {detailAuditLogs.slice(0, 5).map((log: any) => (
                        <div key={log.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                          <div className="flex items-center justify-between text-[11px]">
                            <strong className="text-navy-900 font-mono">{log.action}</strong>
                            <span className="text-slate-400">{formatDate(log.createdAt)}</span>
                          </div>
                          <p className="text-slate-600 text-[11px] mt-0.5">
                            By {log.actor?.name} ({log.actorRole})
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
