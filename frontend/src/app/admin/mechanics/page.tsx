'use client';

import React, { useState, useEffect } from 'react';
import { Users, Plus, Star, Wrench, ShieldCheck, X, Search, Building2, RefreshCw, AlertTriangle } from 'lucide-react';
import { AppLayout } from '../../../components/layout/AppLayout';
import { api } from '../../../lib/api';
import { useToast } from '../../../context/ToastContext';

export default function AdminMechanicsPage() {
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [garages, setGarages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

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
    'ENGINE',
    'BRAKES',
    'ELECTRICAL',
    'AC',
    'SUSPENSION',
    'GENERAL_SERVICE',
    'BODYWORK',
  ];

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
                    <th className="py-3.5 px-4">Skills</th>
                    <th className="py-3.5 px-4">Rating</th>
                    <th className="py-3.5 px-4">Active / Completed</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Master Override</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mechanics.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block">{m.name}</span>
                        <span className="text-[10px] text-slate-400">{m.phone} &bull; {m.email}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800 block flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-brand-cyan" /> {m.garageName}
                        </span>
                        <span className="text-[10px] text-slate-400">{m.garageCity}</span>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
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
    </AppLayout>
  );
}
