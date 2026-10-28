'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Wrench,
  Car,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  Star,
  Users,
  ShieldCheck,
  UserCheck,
  Download,
} from 'lucide-react';
import { AppLayout } from '../../../../components/layout/AppLayout';
import { StatusBadge } from '../../../../components/common/StatusBadge';
import { StatusTimeline } from '../../../../components/common/StatusTimeline';
import { CardSkeleton } from '../../../../components/common/LoadingSkeleton';
import { api } from '../../../../lib/api';
import { formatINR, formatDate } from '../../../../lib/utils';
import { useToast } from '../../../../context/ToastContext';
import { getSocket } from '../../../../lib/socket';

export default function AdminRequestDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [request, setRequest] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [allMechanics, setAllMechanics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [selectedMechanicId, setSelectedMechanicId] = useState('');
  const [assignNote, setAssignNote] = useState('');

  const { success, error } = useToast();

  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqData, mechData] = await Promise.all([
        api.get<{ request: any }>(`/requests/${id}`),
        api.get<{ mechanics: any[] }>('/mechanics'),
      ]);

      setRequest(reqData.request);
      setAllMechanics(mechData.mechanics);

      // If request is SUBMITTED or unassigned, fetch ranked suggestions
      if (reqData.request.status === 'SUBMITTED' || !reqData.request.mechanicId) {
        const suggData = await api.get<any>(`/requests/${id}/suggestions`);
        setSuggestions(suggData.suggestions || []);
        if (suggData.suggestions && suggData.suggestions.length > 0) {
          setSelectedMechanicId(suggData.suggestions[0].mechanicId);
        }
      }
    } catch (err: any) {
      error(err.message || 'Failed to load request details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    fetchData();

    const socket = getSocket();
    if (!socket) return;

    socket.emit('request:join', id);

    const onRequestUpdated = (updated: any) => {
      if (updated.id === id) {
        setRequest(updated);
        success(`Request update: ${updated.status}`);
      }
    };

    socket.on('request:updated', onRequestUpdated);
    return () => {
      socket.emit('request:leave', id);
      socket.off('request:updated', onRequestUpdated);
    };
  }, [id]);

  const handleAssignMechanic = async (mechanicIdToAssign?: string, autoAssign = false) => {
    try {
      setAssigning(true);
      const targetId = autoAssign ? undefined : (mechanicIdToAssign || selectedMechanicId);

      const res = await api.post<any>(`/requests/${id}/assign`, {
        mechanicId: targetId,
        autoAssign,
        note: assignNote.trim() || undefined,
      });

      success(res.message || 'Mechanic assigned successfully!');
      setRequest(res.request);
      setSuggestions([]);
    } catch (err: any) {
      error(err.message || 'Failed to assign mechanic');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </AppLayout>
    );
  }

  if (!request) {
    return (
      <AppLayout>
        <div className="p-8 text-center space-y-4">
          <p className="text-sm text-slate-500">Request not found.</p>
          <Link href="/admin/requests" className="text-xs font-bold text-brand-orange hover:underline">
            Back to Requests
          </Link>
        </div>
      </AppLayout>
    );
  }

  const isAssignable = request.status === 'SUBMITTED' || !request.mechanicId;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              href="/admin/requests"
              className="text-xs font-bold text-slate-500 hover:text-navy-900 inline-flex items-center gap-1.5 mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Operations Queue
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-navy-900 font-mono">
                {request.requestNumber}
              </h1>
              <StatusBadge status={request.status} />
            </div>
            <p className="text-xs text-slate-500">
              Customer: {request.customer.name} ({request.customer.phone}) | Garage: {request.garage.name}
            </p>
          </div>
        </div>

        {/* Smart Mechanic Assignment Panel (When Unassigned / SUBMITTED) */}
        {isAssignable && (
          <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-navy-800 space-y-6 animate-slide-up">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-navy-800/80">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-cyan/20 text-brand-cyan text-xs font-bold border border-brand-cyan/30">
                  <Sparkles className="w-3.5 h-3.5" /> Smart Assignment Engine
                </div>
                <h2 className="text-xl font-black text-white">
                  Ranked Mechanic Recommendations ({request.category})
                </h2>
                <p className="text-xs text-slate-300">
                  Filtered by certified skill match, verified garage in {request.garage.city}, and availability.
                  Score formula: <span className="font-mono text-brand-orange">Rating − (Active Jobs × 0.5)</span>
                </p>
              </div>

              {/* 1-Click Auto Assign Button */}
              {suggestions.length > 0 && (
                <button
                  disabled={assigning}
                  onClick={() => handleAssignMechanic(undefined, true)}
                  className="px-6 py-3 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-black shadow-lg shadow-brand-orange/30 flex items-center gap-2 transition-all shrink-0"
                >
                  <UserCheck className="w-4 h-4" /> 1-Click Auto-Assign Best Match
                </button>
              )}
            </div>

            {/* Suggestions Cards Grid */}
            {suggestions.length === 0 ? (
              <div className="p-6 rounded-2xl bg-navy-900/60 border border-navy-800 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">No Direct Skill Matches Online</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  No verified mechanics with certified skill in {request.category} are marked available right now. You can manually assign any mechanic below.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {suggestions.map((sugg, idx) => {
                  const isSelected = selectedMechanicId === sugg.mechanicId;

                  return (
                    <div
                      key={sugg.mechanicId}
                      onClick={() => setSelectedMechanicId(sugg.mechanicId)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all relative ${
                        isSelected
                          ? 'bg-navy-800 border-brand-orange ring-2 ring-brand-orange/40 shadow-xl'
                          : 'bg-navy-950/70 border-navy-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-orange/20 text-brand-orange border border-brand-orange/30">
                          Rank #{idx + 1} Best Match
                        </span>
                        <span className="text-xs font-mono font-black text-brand-cyan">
                          Score: {sugg.score.toFixed(2)}
                        </span>
                      </div>

                      <h4 className="text-sm font-extrabold text-white">{sugg.name}</h4>

                      <div className="mt-2 space-y-1 text-xs text-slate-300">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-amber-400">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            {sugg.rating.toFixed(1)} / 5.0
                          </span>
                          <span className="text-slate-400">
                            Active Jobs: <strong>{sugg.activeJobCount}</strong>
                          </span>
                        </div>
                      </div>

                      <ul className="mt-3 pt-2 border-t border-navy-800/80 space-y-1 text-[11px] text-slate-400">
                        {sugg.reasons.map((r: string, i: number) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate">{r}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAssignMechanic(sugg.mechanicId, false);
                        }}
                        disabled={assigning}
                        className="mt-4 w-full py-2 rounded-xl bg-navy-700 hover:bg-brand-orange text-white text-xs font-bold transition-colors"
                      >
                        Assign This Mechanic
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Manual Override Selector */}
            <div className="pt-4 border-t border-navy-800/80 flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 w-full">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Manual Assignment Override
                </label>
                <select
                  value={selectedMechanicId}
                  onChange={(e) => setSelectedMechanicId(e.target.value)}
                  className="w-full text-xs font-semibold rounded-xl border border-navy-700 p-2.5 bg-navy-950 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                >
                  <option value="">Select any mechanic manually...</option>
                  {allMechanics.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name} ({m.garageName}) — {m.rating}★ | {m.skills.join(', ')} | Active: {m.activeJobCount}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:w-auto self-end pt-5">
                <button
                  disabled={!selectedMechanicId || assigning}
                  onClick={() => handleAssignMechanic(selectedMechanicId, false)}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-navy-800 hover:bg-navy-700 text-white text-xs font-bold border border-navy-700 transition-colors disabled:opacity-50"
                >
                  {assigning ? 'Assigning...' : 'Confirm Manual Assignment'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 9-Stage Progress Timeline */}
        <StatusTimeline
          currentStatus={request.status}
          history={request.statusHistory}
        />

        {/* Two-Column Details View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Diagnosis */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-extrabold text-navy-900 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-brand-orange" />
                Technical Diagnosis & Inspection Notes
              </h3>
              {request.diagnosis ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-navy-900 font-medium">
                  {request.diagnosis}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No diagnosis recorded yet.</p>
              )}
            </div>

            {/* Estimates */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-navy-900">
                  Estimates ({request.estimates?.length || 0})
                </h3>
              </div>

              {request.estimates?.map((est: any) => (
                <div key={est.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono font-bold text-navy-900">
                      Version #{est.version} — <span className="uppercase">{est.status}</span>
                    </span>
                    <span className="text-sm font-black text-brand-orange">
                      {formatINR(est.totalPaise)}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-200 text-xs">
                    {est.items?.map((item: any) => (
                      <div key={item.id} className="py-1.5 flex justify-between">
                        <span className="text-slate-700">
                          [{item.kind}] {item.description} (x{item.quantity})
                        </span>
                        <span className="font-bold text-navy-900">
                          {formatINR(item.totalPaise)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Customer problem description */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-2">
              <h3 className="text-sm font-extrabold text-navy-900">Owner's Description</h3>
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                "{request.description}"
              </p>
            </div>
          </div>

          {/* Right Column (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Vehicle Details */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Vehicle
              </span>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-navy-900 text-white flex items-center justify-center font-bold">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-navy-900">
                    {request.vehicle.make} {request.vehicle.model}
                  </h4>
                  <p className="text-xs font-mono font-bold text-brand-orange">
                    {request.vehicle.regNo}
                  </p>
                </div>
              </div>
            </div>

            {/* Customer Details */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Customer Details
              </span>
              <p className="font-bold text-navy-900">{request.customer.name}</p>
              <p className="text-slate-600">Email: {request.customer.email}</p>
              <p className="text-slate-600">Phone: {request.customer.phone}</p>
            </div>

            {/* Assigned Mechanic */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Assigned Mechanic
              </span>
              {request.mechanic ? (
                <>
                  <p className="font-bold text-navy-900">{request.mechanic.name}</p>
                  <p className="text-slate-600">Phone: {request.mechanic.phone}</p>
                </>
              ) : (
                <span className="text-amber-600 font-bold">No mechanic currently assigned.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
