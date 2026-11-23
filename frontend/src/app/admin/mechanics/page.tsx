'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Plus,
  Star,
  Wrench,
  ShieldCheck,
  X,
  Search,
  Building2,
  RefreshCw,
  AlertTriangle,
  User,
  Mail,
  Phone,
  Car,
  Clock,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { formatDate } from '../../../lib/utils';
import { AppLayout } from '../../../components/layout/AppLayout';
import { api } from '../../../lib/api';
import { useToast } from '../../../context/ToastContext';

export default function AdminMechanicsPage() {
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [garages, setGarages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [detailMechanic, setDetailMechanic] = useState<any>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Tag Skills Modal for Mechanics Pending Review
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [taggingMechanic, setTaggingMechanic] = useState<any>(null);
  const [taggingSkills, setTaggingSkills] = useState<string[]>([]);
  const [taggingSubmitting, setTaggingSubmitting] = useState(false);

  const handleOpenMechanicDetail = async (id: string) => {
    try {
      setDrawerLoading(true);
      setDetailDrawerOpen(true);
      const res = await api.get<{ mechanic: any; activeAssignments: any[]; recentCompletedJobs: any[] }>(
        `/admin/mechanics/${id}`
      );
      setDetailMechanic(res);
    } catch (err: any) {
      error(err.message || 'Failed to load technician details');
    } finally {
      setDrawerLoading(false);
    }
  };

  // Filters
  const [garageFilter, setGarageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // New Mechanic Form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [garageId, setGarageId] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['ENGINE', 'BRAKES']);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const { success, error } = useToast();

  const fetchData = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (garageFilter) query.set('garageId', garageFilter);
      if (statusFilter !== 'ALL') query.set('status', statusFilter);
      if (searchQuery.trim()) query.set('search', searchQuery.trim());

      const [mechData, garageData] = await Promise.all([
        api.get<{ mechanics: any[] }>(`/admin/mechanics?${query.toString()}`),
        api.get<{ garages: any[] }>('/admin/garages'),
      ]);
      setMechanics(mechData.mechanics || []);
      setGarages(garageData.garages || []);
      if (garageData.garages?.length > 0 && !garageId) {
        setGarageId(garageData.garages[0].id);
      }
    } catch (err: any) {
      error(err.message || 'Failed to load mechanics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [garageFilter, statusFilter]);

  const handleSuspend = async (mechId: string, mechName: string) => {
    if (!confirm(`Are you sure you want to suspend ${mechName} across the platform?`)) return;

    try {
      await api.post(`/admin/mechanics/${mechId}/suspend`, { reason: 'Suspended by Master Admin override' });
      success(`Mechanic ${mechName} suspended.`);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to suspend mechanic');
    }
  };

  const handleReactivate = async (mechId: string, mechName: string) => {
    try {
      await api.post(`/admin/mechanics/${mechId}/reactivate`, {});
      success(`Mechanic ${mechName} reactivated successfully!`);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to reactivate mechanic');
    }
  };

  const handleCreateMechanic = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    if (selectedSkills.length === 0) {
      setModalError('Please select at least one skill.');
      error('Please select at least one skill.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/mechanics', {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        garageId,
        skills: selectedSkills,
        specialization: specialization.trim() || undefined,
      });

      success(`Mechanic ${name} onboarded successfully!`);
      setModalOpen(false);
      setName('');
      setEmail('');
      setPhone('');
      setSpecialization('');
      fetchData();
    } catch (err: any) {
      const msg = err.message || 'Failed to create mechanic';
      setModalError(msg);
      error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const SKILL_OPTIONS = [
    'EV_BATTERY',
    'HIGH_VOLTAGE_ELECTRICAL',
    'EV_MOTOR',
    'HYBRID_POWERTRAIN',
    'DIESEL_INJECTION',
    'ENGINE',
    'BRAKES',
    'ELECTRICAL',
    'AC',
    'SUSPENSION',
    'GENERAL_SERVICE',
    'BODYWORK',
  ];

  const handleOpenTagModal = (m: any) => {
    setTaggingMechanic(m);
    setTaggingSkills(m.skills || []);
    setTagModalOpen(true);
  };

  const toggleTaggingSkill = (skill: string) => {
    setTaggingSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleSaveTaggedSkills = async () => {
    if (!taggingMechanic) return;
    if (taggingSkills.length === 0) {
      error('Please select at least one certified skill.');
      return;
    }
    try {
      setTaggingSubmitting(true);
      await api.post(`/admin/mechanics/${taggingMechanic.userId || taggingMechanic.id}/tag-skills`, {
        skills: taggingSkills,
      });
      success(`Skills successfully tagged for ${taggingMechanic.name}`);
      setTagModalOpen(false);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to update technician skills');
    } finally {
      setTaggingSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-orange">
              Platform Workforce Supervision
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Users className="w-6 h-6 text-brand-cyan" />
              All Platform Mechanics ({mechanics.length})
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Cross-garage mechanic roster, workload monitoring, ratings, and administrative override suspension.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold shadow-md shadow-brand-orange/20 flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" /> Add Mechanic Manually
            </button>
            <button
              onClick={fetchData}
              className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              title="Refresh List"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={garageFilter}
              onChange={(e) => setGarageFilter(e.target.value)}
              className="py-1.5 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700"
            >
              <option value="">All Garages</option>
              {garages.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.city})
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchData();
            }}
            className="relative w-full sm:w-64"
          >
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search technician name or skill..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 focus:bg-white"
            />
          </form>
        </div>

        {/* Mechanics Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              <div className="w-6 h-6 border-2 border-brand-cyan border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading platform workforce...
            </div>
          ) : mechanics.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              No mechanics found under this filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-3.5 px-4">Mechanic</th>
                    <th className="py-3.5 px-4">Assigned Garage</th>
                    <th className="py-3.5 px-4">Specialization &amp; Skills</th>
                    <th className="py-3.5 px-4">Real-Time Availability</th>
                    <th className="py-3.5 px-4">Rating</th>
                    <th className="py-3.5 px-4">Active / Completed</th>
                    <th className="py-3.5 px-4">Account Status</th>
                    <th className="py-3.5 px-4 text-right">Master Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mechanics.map((m) => (
                    <tr
                      key={m.id}
                      onClick={() => handleOpenMechanicDetail(m.userId || m.id)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 group-hover:text-brand-orange transition-colors block">
                          {m.name}
                        </span>
                        <span className="text-[10px] text-slate-400">{m.phone} &bull; {m.email}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800 block flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-brand-cyan" /> {m.garageName}
                        </span>
                        <span className="text-[10px] text-slate-400">{m.garageCity}</span>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        {m.skillsPendingReview && (
                          <span className="py-0.5 px-2 rounded-full bg-purple-100 text-purple-800 border border-purple-300 text-[9px] font-black uppercase tracking-wider block w-fit mb-1">
                            ⚠️ Skills Pending Review
                          </span>
                        )}
                        <p className="font-bold text-navy-900 text-[11px] mb-1">
                          {m.specialization || 'General Technician'} ({m.experienceYears}y exp)
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {m.skills?.map((sk: string) => (
                            <span
                              key={sk}
                              className="py-0.5 px-1.5 rounded bg-slate-100 text-slate-700 text-[9px] font-bold"
                            >
                              {sk}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            m.availability === 'AVAILABLE'
                              ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                              : m.availability === 'BUSY'
                              ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                              : m.availability === 'ON_BREAK'
                              ? 'bg-purple-500/15 text-purple-600 border border-purple-500/30'
                              : 'bg-slate-200 text-slate-600 border border-slate-300'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              m.availability === 'AVAILABLE'
                                ? 'bg-emerald-500'
                                : m.availability === 'BUSY'
                                ? 'bg-amber-500'
                                : m.availability === 'ON_BREAK'
                                ? 'bg-purple-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          {m.availability || (m.available ? 'AVAILABLE' : 'OFFLINE')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        <span className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          {m.rating}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-blue-600">{m.activeJobs || 0}</span> active /{' '}
                        <span className="font-bold text-emerald-600">{m.completedJobs || 0}</span> done
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`py-1 px-2.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            m.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {m.skillsPendingReview && (
                            <button
                              onClick={() => handleOpenTagModal(m)}
                              className="py-1 px-2.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-[10px] transition-colors border border-purple-200"
                            >
                              Tag Skills
                            </button>
                          )}
                          {m.status === 'ACTIVE' ? (
                            <button
                              onClick={() => handleSuspend(m.userId, m.name)}
                              className="py-1 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[10px] transition-colors"
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivate(m.userId, m.name)}
                              className="py-1 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-bold text-[10px] transition-colors"
                            >
                              Reactivate
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

      {/* Manual Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-orange" />
                Add Mechanic Directly
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMechanic} className="space-y-3">
              {modalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{modalError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Technician Name"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-orange/40 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="mech@repairhub.in"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-orange/40 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-orange/40 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Assign to Garage *</label>
                  <select
                    required
                    value={garageId}
                    onChange={(e) => setGarageId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-orange/40 focus:bg-white"
                  >
                    {garages.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">Temporary Password *</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter technician temporary password (min 8 chars)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-orange/40 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">Specialized Skills</label>
                <div className="flex flex-wrap gap-1.5">
                  {SKILL_OPTIONS.map((sk) => {
                    const isChecked = selectedSkills.includes(sk);
                    return (
                      <button
                        key={sk}
                        type="button"
                        onClick={() => toggleSkill(sk)}
                        className={`py-1 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                          isChecked
                            ? 'bg-brand-orange text-white font-bold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {sk}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="py-2 px-3 rounded-xl bg-slate-100 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="py-2 px-4 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white font-bold disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Onboard Technician'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mechanic Profile Detail Drawer */}
      {detailDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden">
            {/* Drawer Header */}
            <div className="p-6 bg-navy-950 text-white flex items-center justify-between border-b border-navy-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center text-white">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">
                      {detailMechanic?.mechanic?.user?.name || 'Technician Profile'}
                    </h2>
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      {detailMechanic?.mechanic?.rating?.toFixed(1) || '5.0'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {detailMechanic?.mechanic?.garage?.name} &bull; {detailMechanic?.mechanic?.garage?.city}
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
            {drawerLoading || !detailMechanic ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <div className="w-6 h-6 border-2 border-brand-orange border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading technician profile...
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Live Availability Status Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Real-Time Operational Availability
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          detailMechanic.mechanic?.availability === 'AVAILABLE'
                            ? 'bg-emerald-500 animate-pulse'
                            : detailMechanic.mechanic?.availability === 'BUSY'
                            ? 'bg-amber-500'
                            : detailMechanic.mechanic?.availability === 'ON_BREAK'
                            ? 'bg-purple-500'
                            : 'bg-slate-400'
                        }`}
                      />
                      <p className="text-xs font-bold text-navy-900">
                        {detailMechanic.mechanic?.availability === 'AVAILABLE'
                          ? 'Available for New Jobs'
                          : detailMechanic.mechanic?.availability === 'BUSY'
                          ? 'Occupied on Active Repair Job'
                          : detailMechanic.mechanic?.availability === 'ON_BREAK'
                          ? `On Break (${detailMechanic.mechanic?.breakReason || 'Rest'})`
                          : 'Off-Duty / Disconnected'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right sm:text-right">
                    <span className="text-[10px] text-slate-500 block">Account Standing:</span>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        detailMechanic.mechanic?.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {detailMechanic.mechanic?.status}
                    </span>
                  </div>
                </div>

                {/* Contact and Account Info */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4 text-brand-orange" />
                    Technician Credentials &amp; Contact
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Full Legal Name:</span>
                      <strong className="text-navy-900">{detailMechanic.mechanic?.user?.name}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Email Address:</span>
                      <strong className="text-navy-900 font-mono">{detailMechanic.mechanic?.user?.email}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Contact Number:</span>
                      <strong className="text-navy-900 font-mono">{detailMechanic.mechanic?.user?.phone}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Joined Platform:</span>
                      <span className="text-slate-700">{formatDate(detailMechanic.mechanic?.user?.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Professional Qualifications */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-brand-cyan" />
                    Skills, Specialization &amp; Experience
                  </h3>
                  <div className="space-y-3 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Primary Specialization:</span>
                      <strong className="text-navy-900">
                        {detailMechanic.mechanic?.specialization || 'Comprehensive Automotive Repair'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Experience:</span>
                      <strong className="text-navy-900">{detailMechanic.mechanic?.experienceYears} Years in Industry</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px] mb-1.5">Certified Skills:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(detailMechanic.mechanic?.skills || []).map((sk: string) => (
                          <span
                            key={sk}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-[11px] font-bold border border-slate-200"
                          >
                            {sk}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Associated Workshop */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-brand-orange" />
                    Assigned Workshop Details
                  </h3>
                  <div className="text-xs space-y-1 text-slate-600">
                    <p className="font-bold text-navy-900">{detailMechanic.mechanic?.garage?.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {detailMechanic.mechanic?.garage?.address}, {detailMechanic.mechanic?.garage?.city}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Workshop Phone: {detailMechanic.mechanic?.garage?.phone}
                    </p>
                  </div>
                </div>

                {/* Current Active Assignments */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-brand-cyan" />
                    Currently Assigned Repair Jobs ({detailMechanic.activeAssignments?.length || 0})
                  </h3>

                  {detailMechanic.activeAssignments && detailMechanic.activeAssignments.length > 0 ? (
                    <div className="space-y-3">
                      {detailMechanic.activeAssignments.map((req: any) => (
                        <div
                          key={req.id}
                          className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-slate-300 transition-all space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-navy-900 text-xs">
                              {req.requestNumber}
                            </span>
                            <StatusBadge status={req.status} />
                          </div>
                          <div className="flex items-center gap-2 text-xs font-bold text-navy-900">
                            <Car className="w-3.5 h-3.5 text-slate-400" />
                            {req.vehicle?.make} {req.vehicle?.model} ({req.vehicle?.regNo})
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-1">
                            {req.description}
                          </p>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">Customer: {req.customer?.name}</span>
                            <Link
                              href={`/admin/requests/${req.id}`}
                              className="font-bold text-brand-orange hover:underline inline-flex items-center gap-0.5"
                            >
                              Inspect Request &rarr;
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl text-center">
                      No active jobs currently assigned to this technician.
                    </p>
                  )}
                </div>

                {/* Completed Jobs History */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Completed Service Jobs
                    </span>
                    <span className="text-emerald-700 font-bold">
                      {detailMechanic.mechanic?.completedJobs || 0} Total Completed
                    </span>
                  </h3>
                  {detailMechanic.recentCompletedJobs && detailMechanic.recentCompletedJobs.length > 0 ? (
                    <div className="space-y-2">
                      {detailMechanic.recentCompletedJobs.map((job: any) => (
                        <div key={job.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                          <div>
                            <span className="font-mono font-bold text-navy-900">{job.requestNumber}</span>
                            <p className="text-[11px] text-slate-500">{job.vehicle?.make} {job.vehicle?.model}</p>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            COMPLETED
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No completed jobs on record yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Tag Skills Modal for Skills Pending Review */}
      {tagModalOpen && taggingMechanic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-navy-900">
                    Tag Certified Skills: {taggingMechanic.name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Resolves &quot;Skills Pending Review&quot; flag for Master Admin qualification verification
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTagModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">
                Select All Verified Qualifications / Skills:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SKILL_OPTIONS.map((sk) => {
                  const isChecked = taggingSkills.includes(sk);
                  return (
                    <button
                      key={sk}
                      type="button"
                      onClick={() => toggleTaggingSkill(sk)}
                      className={`p-2 rounded-xl text-xs font-bold text-left transition-all border ${
                        isChecked
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="block">{sk}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setTagModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={taggingSubmitting}
                onClick={handleSaveTaggedSkills}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-lg shadow-purple-600/25 transition-all disabled:opacity-50"
              >
                {taggingSubmitting ? 'Saving Skills...' : 'Confirm & Approve Skills'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
