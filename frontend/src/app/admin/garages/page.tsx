'use client';

import React, { useState, useEffect } from 'react';
import { Building2, Plus, ShieldCheck, CheckCircle2, XCircle, X } from 'lucide-react';
import { AppLayout } from '../../../components/layout/AppLayout';
import { api } from '../../../lib/api';
import { useToast } from '../../../context/ToastContext';

export default function AdminGaragesPage() {
  const [garages, setGarages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Kanpur');
  const [phone, setPhone] = useState('');
  const [isVerified, setIsVerified] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { success, error } = useToast();

  const fetchGarages = async () => {
    try {
      setLoading(true);
      const data = await api.get<{ garages: any[] }>('/garages');
      setGarages(data.garages);
    } catch (err: any) {
      error('Failed to load garages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGarages();
  }, []);

  const handleCreateGarage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post('/garages', {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        phone: phone.trim(),
        isVerified,
      });

      success(`Garage "${name}" registered successfully!`);
      setModalOpen(false);
      setName('');
      setAddress('');
      setPhone('');
      fetchGarages();
    } catch (err: any) {
      error(err.message || 'Failed to create garage');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleVerify = async (id: string, currentVerified: boolean) => {
    try {
      await api.patch(`/garages/${id}/verify`, { isVerified: !currentVerified });
      success(`Garage verification status updated.`);
      fetchGarages();
    } catch (err: any) {
      error(err.message || 'Failed to toggle verification');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-orange">
              Network Infrastructure
            </span>
            <h1 className="text-2xl font-black text-navy-900 tracking-tight">
              Partner Garages & Workshops ({garages.length})
            </h1>
            <p className="text-xs text-slate-500">
              Manage physical workshop bays, verification certifications, and location registries.
            </p>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold shadow-md shadow-brand-orange/20 flex items-center gap-2 self-start sm:self-auto transition-all"
          >
            <Plus className="w-4 h-4" /> Register New Garage
          </button>
        </div>

        {/* Garages Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Workshop Name</th>
                  <th className="py-3.5 px-4 sm:px-6">City & Address</th>
                  <th className="py-3.5 px-4 sm:px-6">Phone Number</th>
                  <th className="py-3.5 px-4 sm:px-6">Verification</th>
                  <th className="py-3.5 px-4 sm:px-6">Technicians</th>
                  <th className="py-3.5 px-4 sm:px-6">Repairs Processed</th>
                  <th className="py-3.5 px-4 sm:px-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Loading garages...
                    </td>
                  </tr>
                ) : garages.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No garages registered.
                    </td>
                  </tr>
                ) : (
                  garages.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 font-bold text-navy-900">
                        {g.name}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-slate-600">
                        <span className="font-semibold text-navy-900 block">{g.city}</span>
                        <span className="text-[11px] text-slate-400">{g.address}</span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-slate-700">
                        {g.phone}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6">
                        {g.isVerified ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            Unverified
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 font-semibold text-slate-700">
                        {g._count?.mechanics || 0} mechanics
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 font-extrabold text-navy-900">
                        {g._count?.requests || 0} requests
                      </td>
                      <td className="py-3.5 px-4 sm:px-6">
                        <button
                          onClick={() => handleToggleVerify(g.id, g.isVerified)}
                          className="text-xs font-bold text-brand-cyan hover:underline"
                        >
                          {g.isVerified ? 'Mark Unverified' : 'Verify Garage'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-brand-cyan/20 text-brand-cyan flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-cyan-800" />
                  </div>
                  <h2 className="text-base font-bold text-navy-900">Register Partner Garage</h2>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateGarage} className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-navy-900 block mb-1">Workshop Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Kanpur Precision Motors"
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-navy-900 block mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Kanpur"
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-navy-900 block mb-1">Street Address</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Plot 45, Kidwai Nagar, Kanpur"
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
                    placeholder="0512-2580000"
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="verifyCheckbox"
                    checked={isVerified}
                    onChange={(e) => setIsVerified(e.target.checked)}
                    className="rounded border-slate-300 text-brand-orange focus:ring-brand-orange/50"
                  />
                  <label htmlFor="verifyCheckbox" className="text-xs font-bold text-navy-900">
                    Verify this garage immediately
                  </label>
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
                    {submitting ? 'Registering...' : 'Register Garage'}
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
