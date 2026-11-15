'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Mail,
  Lock,
  Phone,
  User,
  MapPin,
  Clock,
  FileText,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';

const AVAILABLE_SERVICES = [
  { id: 'ENGINE', label: 'Engine Diagnostics & Repair' },
  { id: 'BRAKES', label: 'Brakes & ABS Systems' },
  { id: 'ELECTRICAL', label: 'Electrical & Battery' },
  { id: 'AC', label: 'Air Conditioning & Heating' },
  { id: 'SUSPENSION', label: 'Suspension & Steering' },
  { id: 'GENERAL_SERVICE', label: 'Periodic Maintenance & Oil Service' },
  { id: 'BODYWORK', label: 'Bodywork, Denting & Painting' },
];

export default function GarageRegisterPage() {
  const router = useRouter();
  const { setAuthData } = useAuth();
  const { success } = useToast();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Owner Details
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Garage Details
  const [garageName, setGarageName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Kanpur');
  const [state, setState] = useState('Uttar Pradesh');
  const [pinCode, setPinCode] = useState('');
  const [garagePhone, setGaragePhone] = useState('');
  const [operatingHours, setOperatingHours] = useState('09:00 AM - 08:00 PM (Mon - Sat)');
  const [description, setDescription] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([
    'ENGINE',
    'BRAKES',
    'GENERAL_SERVICE',
  ]);

  const toggleService = (svcId: string) => {
    setSelectedServices((prev) =>
      prev.includes(svcId) ? prev.filter((id) => id !== svcId) : [...prev, svcId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (selectedServices.length === 0) {
      setErrorMessage('Please select at least one repair service provided by your garage.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post<{
        message: string;
        user: any;
        garage: any;
        accessToken: string;
        refreshToken: string;
      }>('/garages/register', {
        ownerName: ownerName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        garageName: garageName.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pinCode: pinCode.trim(),
        garagePhone: garagePhone.trim() || phone.trim(),
        description: description.trim(),
        operatingHours: operatingHours.trim(),
        services: selectedServices,
      });

      setAuthData(res.user, res.accessToken, res.refreshToken);
      success('Workshop registered! Your application has been submitted for Master Admin review.');
      router.push('/garage/status');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to register garage. Please review your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 py-12 px-4 sm:px-6 lg:px-8 selection:bg-brand-orange selection:text-white relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-cyan/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-3xl mx-auto space-y-8 relative z-10">
        {/* Header */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-cyan to-blue-600 flex items-center justify-center text-white shadow-xl shadow-brand-cyan/20 group-hover:scale-105 transition-transform">
              <Building2 className="w-6 h-6 text-navy-950 font-bold" />
            </div>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Register Your <span className="text-brand-cyan">Garage / Workshop</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
            Join the RepairHub network in Tier-2 Indian cities. Receive digital service bookings, manage mechanics, and track repair revenue seamlessly.
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-navy-900 border border-navy-800 p-6 sm:p-10 shadow-2xl rounded-3xl space-y-8">
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Section 1: Garage Owner Credentials */}
            <div className="space-y-4">
              <div className="border-b border-navy-800 pb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-brand-cyan" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  1. Garage Owner Account
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Owner Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="e.g. Suresh Sharma"
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-cyan/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Owner Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="owner@sharmaauto.com"
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-cyan/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Mobile Phone *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="9876543210"
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-cyan/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Account Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-cyan/50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Workshop Information */}
            <div className="space-y-4">
              <div className="border-b border-navy-800 pb-2 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-orange" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  2. Garage / Workshop Information
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Workshop Name *
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={garageName}
                      onChange={(e) => setGarageName(e.target.value)}
                      placeholder="e.g. Sharma Auto Works"
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Street Address *
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="124/8 GT Road, Sarvodaya Nagar"
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Kanpur"
                    className="w-full px-4 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    State
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="Uttar Pradesh"
                    className="w-full px-4 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    PIN Code
                  </label>
                  <input
                    type="text"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="208005"
                    className="w-full px-4 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Workshop Phone / Landline
                  </label>
                  <input
                    type="text"
                    value={garagePhone}
                    onChange={(e) => setGaragePhone(e.target.value)}
                    placeholder="0512-2589000"
                    className="w-full px-4 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Operating Hours
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={operatingHours}
                      onChange={(e) => setOperatingHours(e.target.value)}
                      placeholder="09:00 AM - 08:00 PM (Mon - Sat)"
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Short Workshop Description
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your garage expertise, diagnostic equipment, and specializations..."
                    className="w-full px-4 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Services Offered */}
            <div className="space-y-4">
              <div className="border-b border-navy-800 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-brand-cyan" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    3. Supported Repair Categories
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">
                  {selectedServices.length} selected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {AVAILABLE_SERVICES.map((svc) => {
                  const isChecked = selectedServices.includes(svc.id);
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => toggleService(svc.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all ${
                        isChecked
                          ? 'bg-brand-cyan/10 border-brand-cyan/40 text-white'
                          : 'bg-navy-950/60 border-navy-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="font-semibold">{svc.label}</span>
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 ml-2 ${
                          isChecked ? 'text-brand-cyan' : 'text-slate-600'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-navy-800">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-brand-cyan to-blue-500 hover:from-cyan-400 hover:to-blue-600 text-navy-950 font-black text-xs sm:text-sm shadow-xl shadow-brand-cyan/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />
                    Submitting Application...
                  </span>
                ) : (
                  <>
                    Submit Garage for Master Admin Review <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              <p className="text-[11px] text-slate-500 text-center mt-3">
                By submitting, you agree to RepairHub service standards. Accounts are verified within 24 hours.
              </p>
            </div>
          </form>

          <div className="text-center border-t border-navy-800 pt-6">
            <p className="text-xs text-slate-400">
              Already have an approved garage account?{' '}
              <Link href="/login" className="font-bold text-brand-cyan hover:underline">
                Sign In to Garage Portal
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

