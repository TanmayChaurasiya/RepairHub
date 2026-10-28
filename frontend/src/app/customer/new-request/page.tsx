'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Wrench,
  Car,
  Building2,
  FileText,
  Upload,
  ArrowRight,
  ShieldCheck,
  Zap,
  Disc,
  Cpu,
  Wind,
  Layers,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { AppLayout } from '../../../components/layout/AppLayout';
import { api } from '../../../lib/api';
import { useToast } from '../../../context/ToastContext';

const CATEGORIES = [
  { id: 'ENGINE', label: 'Engine & Transmission', icon: Zap, desc: 'Knocking, misfiring, oil leaks, overheating' },
  { id: 'BRAKES', label: 'Brakes & Hydraulics', icon: Disc, desc: 'Spongy pedal, squealing, pad replacement' },
  { id: 'ELECTRICAL', label: 'Electrical & Battery', icon: Cpu, desc: 'Alternator, battery drain, starter, wiring' },
  { id: 'AC', label: 'Air Conditioning & Heating', icon: Wind, desc: 'Warm air, gas leak, compressor issues' },
  { id: 'SUSPENSION', label: 'Suspension & Steering', icon: Layers, desc: 'Shock absorbers, struts, wheel alignment' },
  { id: 'GENERAL_SERVICE', label: 'General Service & Oil Flush', icon: Wrench, desc: 'Scheduled maintenance, fluid flushes, filter tune-up' },
  { id: 'BODYWORK', label: 'Bodywork & Denting/Painting', icon: Sparkles, desc: 'Scratch removal, panel denting, detailing' },
];

export default function NewRepairRequestPage() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [garages, setGarages] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedGarage, setSelectedGarage] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ENGINE');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();
  const { success, error } = useToast();

  useEffect(() => {
    async function loadData() {
      try {
        const [vehData, garageData] = await Promise.all([
          api.get<{ vehicles: any[] }>('/vehicles'),
          api.get<{ garages: any[] }>('/garages'),
        ]);

        setVehicles(vehData.vehicles);
        if (vehData.vehicles.length > 0) {
          setSelectedVehicle(vehData.vehicles[0].id);
        }

        setGarages(garageData.garages);
        if (garageData.garages.length > 0) {
          setSelectedGarage(garageData.garages[0].id);
        }
      } catch (err: any) {
        error('Failed to load initial form data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedVehicle) {
      error('Please select or add a vehicle first.');
      return;
    }
    if (!selectedGarage) {
      error('Please select a service garage.');
      return;
    }
    if (description.trim().length < 10) {
      error('Please describe the problem with at least 10 characters.');
      return;
    }

    try {
      setSubmitting(true);

      // Create request
      const res = await api.post<any>('/requests', {
        vehicleId: selectedVehicle,
        garageId: selectedGarage,
        category: selectedCategory,
        description: description.trim(),
        photos: [],
      });

      const newRequestId = res.request.id;

      // Upload photos if any selected
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach((f) => formData.append('photos', f));
        await api.post(`/requests/${newRequestId}/photos`, formData);
      }

      success('Repair request submitted! Admin will assign an expert mechanic shortly.');
      router.push(`/customer/requests/${newRequestId}`);
    } catch (err: any) {
      error(err.message || 'Failed to submit repair request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-brand-orange">
            Service Booking
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-navy-900 tracking-tight">
            Schedule Vehicle Inspection & Repair
          </h1>
          <p className="text-xs text-slate-500">
            Submit your vehicle issue. Our certified mechanics will inspect it and generate an itemized estimate for your approval.
          </p>
        </div>

        {vehicles.length === 0 && !loading && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
            <span>You must add a vehicle to your account before booking a service.</span>
            <Link
              href="/customer/vehicles"
              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors shrink-0"
            >
              + Add Vehicle
            </Link>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          {/* Vehicle and Garage Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-navy-900 block mb-1.5">
                Select Vehicle
              </label>
              <select
                required
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-3 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.make} {v.model} ({v.year}) — {v.regNo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-navy-900 block mb-1.5">
                Service Garage Location
              </label>
              <select
                required
                value={selectedGarage}
                onChange={(e) => setSelectedGarage(e.target.value)}
                className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-3 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
              >
                {garages.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.city}) {g.isVerified ? '✓ Verified' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category Cards Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-navy-900 block">
              Repair Category
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'border-brand-orange bg-orange-50/50 text-navy-900 ring-2 ring-brand-orange/20 shadow-sm'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/60 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          isSelected
                            ? 'bg-brand-orange text-white'
                            : 'bg-white text-slate-500 border border-slate-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold">{cat.label}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 leading-tight">
                      {cat.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-navy-900 block mb-1.5">
              Describe the Symptoms or Required Work
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Engine knocking sound at idle, mileage has dropped, check engine light came on after expressway drive..."
              className="w-full text-xs rounded-xl border border-slate-300 p-3 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 resize-none"
            />
          </div>

          {/* Photo upload */}
          <div>
            <label className="text-xs font-bold text-navy-900 block mb-1.5">
              Upload Photos / Video clips (Optional, max 5)
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-brand-orange transition-colors">
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-navy-900 file:text-white hover:file:bg-navy-800"
              />
              <p className="text-[11px] text-slate-400 mt-2">
                Images of dashboard warning lights, leakages, or dented areas
              </p>
            </div>
          </div>

          {/* Transparency Promise Banner */}
          <div className="p-4 rounded-2xl bg-navy-900 text-white flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-brand-cyan shrink-0" />
            <p className="text-xs text-slate-300">
              <strong className="text-white">Zero verbal surprises:</strong> Repair work will NEVER start until you review and approve the mechanic’s itemized digital estimate.
            </p>
          </div>

          {/* Submit */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting || vehicles.length === 0}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold shadow-lg shadow-brand-orange/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {submitting ? 'Submitting Request...' : 'Submit Service Request'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
