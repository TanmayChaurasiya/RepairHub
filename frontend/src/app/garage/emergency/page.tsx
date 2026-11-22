'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Radio,
  MapPin,
  Car,
  Wrench,
  Clock,
  PhoneCall,
  CheckCircle2,
  RefreshCw,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import { AppLayout } from '../../../components/layout/AppLayout';
import { api } from '../../../lib/api';
import { formatDate } from '../../../lib/utils';
import { useToast } from '../../../context/ToastContext';

export default function GarageEmergencyPage() {
  const { success, error } = useToast();

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [incidents, setIncidents] = useState<any[]>([]);

  // Settings
  const [acceptsEmergency, setAcceptsEmergency] = useState(true);
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRadiusKm, setEmergencyRadiusKm] = useState(15);

  const fetchGarageEmergencyData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{ requests: any[] }>('/emergency/requests');
      setIncidents(res.requests || []);
    } catch (err: any) {
      error(err?.message || 'Failed to load garage emergency operations');
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    fetchGarageEmergencyData();
  }, [fetchGarageEmergencyData]);

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      await api.patch('/emergency/provider/settings', {
        acceptsEmergency,
        emergencyRadiusKm: Number(emergencyRadiusKm),
      });
      success('Garage roadside assistance settings updated successfully.');
    } catch (err: any) {
      error(err?.message || 'Failed to update settings');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-navy-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-orange/20 text-brand-orange border border-brand-orange/30 text-xs font-bold">
              <Building2 className="w-3.5 h-3.5" /> Workshop Emergency Ops
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Roadside Service Station Center
            </h1>
            <p className="text-xs text-slate-300">
              Configure your workshop&apos;s 24x7 roadside response capability, dispatched technicians, and emergency coverage radius across Kanpur.
            </p>
          </div>

          <button
            onClick={fetchGarageEmergencyData}
            className="p-3 rounded-2xl bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white transition-colors border border-navy-700 flex items-center gap-2 text-xs font-bold"
          >
            <RefreshCw className="w-4 h-4" /> Refresh Ops
          </button>
        </div>

        {/* Configuration Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h2 className="text-sm font-black text-navy-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-brand-orange" />
              Roadside Assistance Dispatch Settings
            </h2>
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="px-5 py-2.5 rounded-xl bg-navy-900 hover:bg-brand-orange text-white text-xs font-black shadow-md transition-all"
            >
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Toggle Acceptance */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-700 block">Roadside Duty Status</span>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-navy-950">
                  {acceptsEmergency ? 'Active & Ready' : 'Standby / Paused'}
                </span>
                <button
                  type="button"
                  onClick={() => setAcceptsEmergency(!acceptsEmergency)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    acceptsEmergency ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                      acceptsEmergency ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                When enabled, nearby emergency dispatches will be offered to your technicians.
              </p>
            </div>

            {/* Emergency Phone */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Emergency 24x7 Hotline
              </label>
              <input
                type="text"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-navy-900"
              />
              <p className="text-[11px] text-slate-500">
                Displayed to customers for direct roadside communication.
              </p>
            </div>

            {/* Emergency Radius */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Response Service Radius
              </label>
              <select
                value={emergencyRadiusKm}
                onChange={(e) => setEmergencyRadiusKm(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-navy-900"
              >
                <option value={10}>10 Kilometers</option>
                <option value={15}>15 Kilometers (Recommended)</option>
                <option value={25}>25 Kilometers</option>
                <option value={40}>40 Kilometers (Extended Highway)</option>
              </select>
              <p className="text-[11px] text-slate-500">
                Maximum distance your mechanics are willing to travel for on-site repairs.
              </p>
            </div>
          </div>
        </div>

        {/* Workshop Dispatches Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-black text-navy-900">
              Workshop Emergency Dispatches ({incidents.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">SOS Incident</th>
                  <th className="py-3.5 px-4">Problem Category</th>
                  <th className="py-3.5 px-4">Customer &amp; Vehicle</th>
                  <th className="py-3.5 px-4">Dispatched Technician</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Date &amp; Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {incidents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No emergency dispatches logged for this workshop yet.
                    </td>
                  </tr>
                ) : (
                  incidents.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4 font-mono font-black text-navy-950">
                        #{inc.requestNumber}
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full text-[11px]">
                          {inc.category}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-bold text-navy-900">{inc.customer?.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {inc.vehicle?.make} {inc.vehicle?.model} ({inc.vehicle?.regNo})
                        </p>
                      </td>
                      <td className="py-4 px-4 font-bold text-navy-900">
                        {inc.mechanicProfile?.user?.name || (
                          <span className="text-amber-600 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-black text-xs text-navy-950">{inc.status}</span>
                      </td>
                      <td className="py-4 px-4 text-right text-slate-500 font-mono">
                        {formatDate(inc.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
