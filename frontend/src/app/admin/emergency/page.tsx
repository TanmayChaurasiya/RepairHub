'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  ShieldAlert,
  Radio,
  MapPin,
  Car,
  Wrench,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  UserCheck,
  FileText,
  Phone,
} from 'lucide-react';
import { AppLayout } from '../../../components/layout/AppLayout';
import { api } from '../../../lib/api';
import { formatDate } from '../../../lib/utils';
import { useToast } from '../../../context/ToastContext';

const EmergencyMap = dynamic(() => import('../../../components/emergency/EmergencyMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[360px] rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200">
      <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function AdminEmergencyPage() {
  const { success, error } = useToast();

  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Reassignment Modal State
  const [reassignModalIncident, setReassignModalIncident] = useState<any | null>(null);
  const [eligibleMechanics, setEligibleMechanics] = useState<any[]>([]);
  const [selectedMechanicId, setSelectedMechanicId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassigning, setReassigning] = useState(false);

  // History Drawer State
  const [historyIncident, setHistoryIncident] = useState<any | null>(null);

  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'ALL') queryParams.set('status', statusFilter);
      if (search.trim()) queryParams.set('search', search.trim());

      const res = await api.get<{ requests: any[] }>(`/emergency/requests?${queryParams.toString()}`);
      setIncidents(res.requests || []);
    } catch (err: any) {
      error(err?.message || 'Failed to load emergency incidents');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, error]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const openReassignModal = async (incident: any) => {
    setReassignModalIncident(incident);
    setReassignReason('');
    setSelectedMechanicId('');
    try {
      const res = await api.get<{ mechanics: any[] }>('/admin/mechanics');
      setEligibleMechanics(res.mechanics || []);
    } catch (err: any) {
      error('Failed to load eligible mechanics');
    }
  };

  const handleExecuteReassignment = async () => {
    if (!selectedMechanicId) {
      error('Please select a replacement mechanic');
      return;
    }
    if (!reassignReason.trim()) {
      error('Reassignment reason is required for administrative audit');
      return;
    }

    try {
      setReassigning(true);
      await api.post(`/emergency/requests/${reassignModalIncident.id}/reassign`, {
        newMechanicId: selectedMechanicId,
        reason: reassignReason.trim(),
      });
      success('Emergency incident successfully reassigned with audit log.');
      setReassignModalIncident(null);
      fetchIncidents();
    } catch (err: any) {
      error(err?.message || 'Failed to reassign mechanic');
    } finally {
      setReassigning(false);
    }
  };

  const activeCount = incidents.filter(
    (i) => !['COMPLETED', 'CANCELLED', 'UNFULFILLED'].includes(i.status)
  ).length;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-red-950 via-navy-950 to-red-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-red-900 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/30 text-red-400 border border-red-500/30 text-xs font-bold">
              <Radio className="w-3.5 h-3.5 animate-pulse" /> City Emergency Command Center
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Roadside Emergency Command ({incidents.length})
            </h1>
            <p className="text-xs text-slate-300">
              Live oversight of all stranded motorists, SOS calls, real-time technician routes, and emergency assignments across Kanpur.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchIncidents}
              className="p-3 rounded-2xl bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white transition-colors border border-navy-700 flex items-center gap-2 text-xs font-bold"
            >
              <RefreshCw className="w-4 h-4" /> Live Refresh
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Active SOS Dispatches</span>
            <p className="text-3xl font-black text-navy-950 mt-1">{activeCount}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Completed Roadside</span>
            <p className="text-3xl font-black text-navy-950 mt-1">
              {incidents.filter((i) => i.status === 'COMPLETED').length}
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cancelled by User</span>
            <p className="text-3xl font-black text-navy-950 mt-1">
              {incidents.filter((i) => i.status === 'CANCELLED').length}
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Total Incidents</span>
            <p className="text-3xl font-black text-navy-950 mt-1">{incidents.length}</p>
          </div>
        </div>

        {/* City Map Overview */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-black text-navy-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-red-600" />
            Live Kanpur Roadside Incident Distribution
          </h2>
          <EmergencyMap
            customerLocation={
              incidents[0]
                ? {
                    lat: incidents[0].pickupLatitude ?? incidents[0].latitude ?? 26.4735,
                    lng: incidents[0].pickupLongitude ?? incidents[0].longitude ?? 80.3075,
                  }
                : null
            }
            nearbyGarages={incidents
              .filter((i) => !['COMPLETED', 'CANCELLED'].includes(i.status))
              .map((i) => ({
                id: i.id,
                name: `SOS #${i.requestNumber} (${i.category})`,
                lat: i.pickupLatitude ?? i.latitude ?? 26.4735,
                lng: i.pickupLongitude ?? i.longitude ?? 80.3075,
                phone: i.customer?.phone,
              }))}
            height="340px"
            zoom={12}
          />
        </div>

        {/* Incidents Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search incident number, customer, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-navy-900 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              {['ALL', 'SEARCHING', 'ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-navy-950 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Incident</th>
                  <th className="py-3.5 px-4">Customer Details</th>
                  <th className="py-3.5 px-4">Vehicle</th>
                  <th className="py-3.5 px-4">Breakdown Location</th>
                  <th className="py-3.5 px-4">Assigned Technician</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {incidents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No roadside incidents found.
                    </td>
                  </tr>
                ) : (
                  incidents.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-4">
                        <span className="font-mono font-black text-navy-950 block">
                          #{inc.requestNumber}
                        </span>
                        <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md mt-1 inline-block">
                          {inc.category}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <p className="font-bold text-navy-900">{inc.customer?.name}</p>
                        <p className="text-[11px] text-slate-500">{inc.customer?.phone}</p>
                      </td>

                      <td className="py-4 px-4">
                        <p className="font-bold text-navy-900">
                          {inc.vehicle?.make} {inc.vehicle?.model}
                        </p>
                        <span className="text-[10px] font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                          {inc.vehicle?.regNo}
                        </span>
                      </td>

                      <td className="py-4 px-4 max-w-[200px]">
                        <p className="truncate text-slate-700" title={inc.pickupAddress}>
                          {inc.pickupAddress}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {(inc.pickupLatitude ?? inc.latitude) != null
                            ? `${(inc.pickupLatitude ?? inc.latitude).toFixed(4)}, ${(inc.pickupLongitude ?? inc.longitude).toFixed(4)}`
                            : 'GPS recorded'}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        {inc.assignedMechanic || inc.mechanicProfile ? (
                          <div>
                            <p className="font-bold text-navy-900">
                              {inc.assignedMechanic?.name || inc.mechanicProfile?.user?.name}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {inc.garage?.name || inc.mechanicProfile?.garage?.name || 'Assigned Workshop'}
                            </p>
                          </div>
                        ) : (
                          <span className="text-amber-600 text-[11px] font-bold italic">
                            Unassigned / Auto-Routing
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                            inc.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : inc.status === 'CANCELLED'
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {inc.status}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-right space-x-2">
                        {inc.status !== 'COMPLETED' && inc.status !== 'CANCELLED' && (
                          <button
                            onClick={() => openReassignModal(inc)}
                            className="px-3 py-1.5 rounded-lg bg-navy-900 hover:bg-brand-orange text-white text-xs font-bold transition-all"
                          >
                            Reassign
                          </button>
                        )}
                        <button
                          onClick={() => setHistoryIncident(inc)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
                        >
                          Audit Log
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Manual Reassignment Modal */}
        {reassignModalIncident && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-navy-950 flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-brand-orange" />
                  Administrative Mechanic Reassignment
                </h3>
                <p className="text-xs text-slate-500">
                  Override active dispatch for SOS #{reassignModalIncident.requestNumber}.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">Select Eligible Technician</label>
                <select
                  value={selectedMechanicId}
                  onChange={(e) => setSelectedMechanicId(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-semibold text-navy-900"
                >
                  <option value="">-- Choose verified technician --</option>
                  {eligibleMechanics.map((m) => (
                    <option key={m.userId || m.id} value={m.userId || m.user?.id || m.id}>
                      {m.name || m.user?.name} ({m.garage?.name || m.garageName || 'Kanpur Workshop'}) - {m.specialization || 'Certified'}
                    </option>
                  ))}
                </select>

                <label className="block text-xs font-bold text-slate-700">Audit Justification Reason</label>
                <textarea
                  rows={3}
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="e.g. Previous mechanic experienced vehicle breakdown, technician closer with towing rig..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs text-navy-900"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setReassignModalIncident(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteReassignment}
                  disabled={reassigning || !selectedMechanicId}
                  className="flex-1 py-2.5 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold"
                >
                  {reassigning ? 'Reassigning...' : 'Confirm Reassignment'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Audit Log Drawer */}
        {historyIncident && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end">
            <div className="bg-white w-full max-w-md h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto">
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-base font-black text-navy-950">
                    Audit Trail: #{historyIncident.requestNumber}
                  </h3>
                  <button
                    onClick={() => setHistoryIncident(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase">Status Timeline</h4>
                  <div className="space-y-2 border-l-2 border-slate-200 pl-4 ml-2">
                    {historyIncident.statusHistory?.map((sh: any) => (
                      <div key={sh.id} className="text-xs space-y-0.5">
                        <span className="font-black text-navy-900">{sh.status}</span>
                        <p className="text-[10px] text-slate-400">{formatDate(sh.createdAt)}</p>
                        {sh.notes && <p className="text-[11px] text-slate-600 italic">{sh.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>

                {historyIncident.assignmentHistory?.length > 0 && (
                  <div className="space-y-3 pt-3">
                    <h4 className="text-xs font-bold text-slate-500 uppercase">Technician Assignments</h4>
                    <div className="space-y-2">
                      {historyIncident.assignmentHistory.map((ah: any) => (
                        <div key={ah.id} className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                          <p className="font-bold text-navy-900">
                            Reassigned by Admin #{ah.adminId?.slice(0, 6)}
                          </p>
                          <p className="text-[11px] text-slate-600">Reason: &quot;{ah.reason}&quot;</p>
                          <p className="text-[10px] text-slate-400">{formatDate(ah.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setHistoryIncident(null)}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Close Audit
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
