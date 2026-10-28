'use client';

import React, { useState, useEffect } from 'react';
import { Users, Plus, Star, Wrench, ShieldCheck, X } from 'lucide-react';
import { AppLayout } from '../../../components/layout/AppLayout';
import { CardSkeleton } from '../../../components/common/LoadingSkeleton';
import { api } from '../../../lib/api';
import { useToast } from '../../../context/ToastContext';

export default function AdminMechanicsPage() {
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [garages, setGarages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // New Mechanic Form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('Password123!');
  const [garageId, setGarageId] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['ENGINE', 'BRAKES']);
  const [submitting, setSubmitting] = useState(false);

  const { success, error } = useToast();

  const fetchData = async () => {
    try {
      setLoading(true);
      const [mechData, garageData] = await Promise.all([
        api.get<{ mechanics: any[] }>('/mechanics'),
        api.get<{ garages: any[] }>('/garages'),
      ]);
      setMechanics(mechData.mechanics);
      setGarages(garageData.garages);
      if (garageData.garages.length > 0) {
        setGarageId(garageData.garages[0].id);
      }
    } catch (err: any) {
      error('Failed to load mechanics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateMechanic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSkills.length === 0) {
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
      });

      success(`Mechanic ${name} onboarded successfully!`);
      setModalOpen(false);
      setName('');
      setEmail('');
      setPhone('');
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to create mechanic');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-orange">
              Workforce Roster
            </span>
            <h1 className="text-2xl font-black text-navy-900 tracking-tight">
              Mechanics & Technicians ({mechanics.length})
            </h1>
            <p className="text-xs text-slate-500">
              Manage skill certifications, bay assignments, workloads, and quality ratings.
            </p>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold shadow-md shadow-brand-orange/20 flex items-center gap-2 self-start sm:self-auto transition-all"
          >
            <Plus className="w-4 h-4" /> Onboard New Mechanic
          </button>
        </div>

        {/* Mechanics Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Mechanic Name</th>
                  <th className="py-3.5 px-4 sm:px-6">Workshop / Garage</th>
                  <th className="py-3.5 px-4 sm:px-6">Certified Skills</th>
                  <th className="py-3.5 px-4 sm:px-6">Status</th>
                  <th className="py-3.5 px-4 sm:px-6">Rating</th>
                  <th className="py-3.5 px-4 sm:px-6">Active Jobs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Loading mechanics roster...
                    </td>
                  </tr>
                ) : mechanics.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No mechanics created yet.
                    </td>
                  </tr>
                ) : (
                  mechanics.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6">
                        <span className="font-bold text-navy-900 block">{m.name}</span>
                        <span className="text-slate-400 text-[11px]">{m.email}</span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6">
                        <span className="font-semibold text-slate-700 block">{m.garageName}</span>
                        <span className="text-[10px] text-slate-400">
                          {m.garageCity} {m.garageVerified ? '✓ Verified' : ''}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex flex-wrap gap-1">
                          {m.skills.map((s: string) => (
                            <span
                              key={s}
                              className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                            m.available
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {m.available ? 'Available' : 'Busy'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6">
                        <span className="inline-flex items-center gap-1 font-bold text-navy-900">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          {m.rating.toFixed(1)} ({m.totalReviews})
                        </span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 font-extrabold text-navy-900">
                        {m.activeJobCount} in bay
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Mechanic Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-brand-orange/10 text-brand-orange flex items-center justify-center">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <h2 className="text-base font-bold text-navy-900">Onboard Mechanic Account</h2>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateMechanic} className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-navy-900 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Deepak Srivastav"
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-navy-900 block mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="deepak@repairhub.in"
                      className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-navy-900 block mb-1">Phone Number</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="9876543200"
                      className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-navy-900 block mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-navy-900 block mb-1">Garage Workshop</label>
                  <select
                    value={garageId}
                    onChange={(e) => setGarageId(e.target.value)}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                  >
                    {garages.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-navy-900 block mb-1.5">
                    Certified Skills (Select all that apply)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'ENGINE',
                      'BRAKES',
                      'ELECTRICAL',
                      'AC',
                      'SUSPENSION',
                      'GENERAL_SERVICE',
                      'BODYWORK',
                    ].map((s) => {
                      const isChecked = selectedSkills.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleSkill(s)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                            isChecked
                              ? 'bg-brand-orange text-white border-brand-orange'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {isChecked ? '✓ ' : '+ '}
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold shadow-md shadow-brand-orange/20 disabled:opacity-50"
                  >
                    {submitting ? 'Onboarding...' : 'Create Mechanic'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
