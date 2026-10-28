'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Car, Plus, ArrowRight, Calendar, Tag, ShieldCheck, X } from 'lucide-react';
import { AppLayout } from '../../../components/layout/AppLayout';
import { CardSkeleton } from '../../../components/common/LoadingSkeleton';
import { api } from '../../../lib/api';
import { useToast } from '../../../context/ToastContext';

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [type, setType] = useState<'CAR' | 'TWO_WHEELER' | 'COMMERCIAL'>('CAR');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [regNo, setRegNo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { success, error } = useToast();

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const data = await api.get<{ vehicles: any[] }>('/vehicles');
      setVehicles(data.vehicles);
    } catch (err: any) {
      error('Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await api.post<{ vehicle: any }>('/vehicles', {
        type,
        make: make.trim(),
        model: model.trim(),
        year: Number(year),
        regNo: regNo.trim().toUpperCase(),
      });

      success(`Vehicle ${res.vehicle.make} ${res.vehicle.model} added!`);
      setModalOpen(false);
      setMake('');
      setModel('');
      setRegNo('');
      fetchVehicles();
    } catch (err: any) {
      error(err.message || 'Failed to add vehicle');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-orange">
              My Garage
            </span>
            <h1 className="text-2xl font-black text-navy-900 tracking-tight">
              Registered Vehicles
            </h1>
            <p className="text-xs text-slate-500">
              Manage your cars, two-wheelers, and commercial vehicles for quick service booking.
            </p>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold shadow-md shadow-brand-orange/20 flex items-center gap-2 self-start sm:self-auto transition-all"
          >
            <Plus className="w-4 h-4" /> Add New Vehicle
          </button>
        </div>

        {/* Vehicles Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 text-brand-orange flex items-center justify-center mx-auto">
              <Car className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-navy-900">No Vehicles Registered</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add your vehicle details once to easily request repairs, track history, and review digital invoices.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="px-6 py-2.5 rounded-xl bg-brand-orange text-white text-xs font-bold hover:bg-brand-orange-hover"
            >
              + Register Vehicle
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {vehicles.map((v) => (
              <div
                key={v.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-hover transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black tracking-wider px-2.5 py-1 rounded-lg bg-navy-900 text-white font-mono shadow-sm">
                      {v.regNo}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                      {v.type}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-navy-900">
                      {v.make} {v.model}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Model Year: {v.year}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">
                    {v._count?.requests || 0} Service Visit(s)
                  </span>
                  <Link
                    href={`/customer/new-request`}
                    className="text-xs font-bold text-brand-orange hover:text-brand-orange-hover flex items-center gap-1"
                  >
                    Book Service <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Vehicle Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-brand-orange/10 text-brand-orange flex items-center justify-center">
                    <Car className="w-4 h-4" />
                  </div>
                  <h2 className="text-base font-bold text-navy-900">Register Vehicle</h2>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddVehicle} className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-navy-900 block mb-1">Vehicle Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                  >
                    <option value="CAR">Car / SUV</option>
                    <option value="TWO_WHEELER">Two-Wheeler (Bike / Scooter)</option>
                    <option value="COMMERCIAL">Commercial Vehicle</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-navy-900 block mb-1">Make</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Maruti Suzuki"
                      value={make}
                      onChange={(e) => setMake(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-navy-900 block mb-1">Model</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Swift Dzire"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-navy-900 block mb-1">Year</label>
                    <input
                      type="number"
                      required
                      min="1990"
                      max={new Date().getFullYear() + 1}
                      value={year}
                      onChange={(e) => setYear(parseInt(e.target.value) || 2020)}
                      className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-navy-900 block mb-1">Registration #</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. UP78-AB-1234"
                      value={regNo}
                      onChange={(e) => setRegNo(e.target.value.toUpperCase())}
                      className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-navy-900 uppercase font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                    />
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
                    {submitting ? 'Saving...' : 'Add Vehicle'}
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
