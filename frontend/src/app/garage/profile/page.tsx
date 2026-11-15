'use client';

import React, { useEffect, useState } from 'react';
import {
  Building2,
  MapPin,
  Clock,
  Phone,
  FileText,
  CheckCircle2,
  Save,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { AppLayout } from '../../../components/layout/AppLayout';
import { api } from '../../../lib/api';
import { useToast } from '../../../context/ToastContext';

const ALL_SERVICES = [
  { id: 'ENGINE', label: 'Engine Diagnostics & Repair' },
  { id: 'BRAKES', label: 'Brakes & ABS Systems' },
  { id: 'ELECTRICAL', label: 'Electrical & Battery' },
  { id: 'AC', label: 'Air Conditioning & Heating' },
  { id: 'SUSPENSION', label: 'Suspension & Steering' },
  { id: 'GENERAL_SERVICE', label: 'Periodic Maintenance & Oil Service' },
  { id: 'BODYWORK', label: 'Bodywork, Denting & Painting' },
];

export default function GarageProfilePage() {
  const { success, error: toastError } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [garage, setGarage] = useState<any>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [phone, setPhone] = useState('');
  const [operatingHours, setOperatingHours] = useState('');
  const [description, setDescription] = useState('');
  const [services, setServices] = useState<string[]>([]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ garage: any }>('/garage/profile');
      const g = res.garage;
      setGarage(g);
      setName(g.name || '');
      setAddress(g.address || '');
      setCity(g.city || '');
      setState(g.state || 'Uttar Pradesh');
      setPinCode(g.pinCode || '');
      setPhone(g.phone || '');
      setOperatingHours(g.operatingHours || '09:00 AM - 08:00 PM (Mon - Sat)');
      setDescription(g.description || '');
      setServices(g.services || []);
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch garage profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const toggleService = (svcId: string) => {
    setServices((prev) =>
      prev.includes(svcId) ? prev.filter((id) => id !== svcId) : [...prev, svcId]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await api.put<{ message: string; garage: any }>('/garage/profile', {
        name,
        address,
        city,
        state,
        pinCode,
        phone,
        operatingHours,
        description,
        services,
      });

      success('Workshop profile updated successfully!');
      setGarage(res.garage);
    } catch (err: any) {
      toastError(err.message || 'Failed to save profile changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="py-20 text-center text-slate-400 text-xs">
          <div className="w-6 h-6 border-2 border-brand-cyan border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading workshop profile...
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-brand-cyan" />
              Workshop Profile Settings
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Update your garage operating hours, supported repairs, and workshop address.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="py-1 px-3 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified Workshop
            </span>
          </div>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-orange" />
              General Workshop Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1.5">
                  Garage / Workshop Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 focus:bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1.5">
                  Street Address
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">City</label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">PIN Code</label>
                <input
                  type="text"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 focus:bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1.5">
                  Operating Hours
                </label>
                <input
                  type="text"
                  value={operatingHours}
                  onChange={(e) => setOperatingHours(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 focus:bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1.5">
                  Workshop Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 focus:bg-white resize-none"
                />
              </div>
            </div>
          </div>

          {/* Services Checklist */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center justify-between">
              <span>Supported Repair Categories</span>
              <span className="text-xs text-slate-400 normal-case font-normal">
                {services.length} categories enabled
              </span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ALL_SERVICES.map((svc) => {
                const isChecked = services.includes(svc.id);
                return (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => toggleService(svc.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all ${
                      isChecked
                        ? 'bg-brand-cyan/10 border-brand-cyan text-slate-900 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{svc.label}</span>
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 ${
                        isChecked ? 'text-brand-cyan' : 'text-slate-300'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="py-3 px-6 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-bold text-xs shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Saving Changes...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Profile Details
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

