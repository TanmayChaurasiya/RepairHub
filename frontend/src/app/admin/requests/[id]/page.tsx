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
  RefreshCw,
  History,
  Lock,
  X,
  AlertTriangle,
  UserX,
  ArrowRight,
  Navigation,
  Radio,
  MapPin,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { AppLayout } from '../../../../components/layout/AppLayout';
import { StatusBadge } from '../../../../components/common/StatusBadge';
import { StatusTimeline } from '../../../../components/common/StatusTimeline';
import { CardSkeleton } from '../../../../components/common/LoadingSkeleton';
import { api } from '../../../../lib/api';
import { formatINR, formatDate } from '../../../../lib/utils';
import { useToast } from '../../../../context/ToastContext';
import { getSocket } from '../../../../lib/socket';

const LiveTrackingMap = dynamic(() => import('../../../../components/common/LiveTrackingMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[360px] rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200">
      <div className="w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

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

  // Reassignment & History States
  const [assignmentHistory, setAssignmentHistory] = useState<any[]>([]);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [eligibleMechanics, setEligibleMechanics] = useState<any[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [reassignMechanicId, setReassignMechanicId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [reassignEligibility, setReassignEligibility] = useState<any>(null);

  // Live Location Tracking States
  const [mechanicLocation, setMechanicLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [liveEtaMinutes, setLiveEtaMinutes] = useState<number | undefined>(undefined);
  const [liveDistanceKm, setLiveDistanceKm] = useState<number | undefined>(undefined);
  const [nearbyGarages, setNearbyGarages] = useState<any[]>([]);

  const { success, error } = useToast();

  const fetchAssignmentHistory = async () => {
    try {
      const res = await api.get<{ histories: any[] }>(`/admin/requests/${id}/assignment-history`);
      setAssignmentHistory(res.histories || []);
    } catch (e) {
      console.error('Failed to load assignment history', e);
    }
  };

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

      await fetchAssignmentHistory();
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
        fetchAssignmentHistory();
        success(`Request update: ${updated.status}`);
      }
    };

    const onRequestLocationUpdated = (data: any) => {
      if (data.requestId === id) {
        setMechanicLocation({ lat: data.latitude, lng: data.longitude });
        if (data.etaMinutes) setLiveEtaMinutes(data.etaMinutes);
        if (data.remainingDistanceKm) setLiveDistanceKm(data.remainingDistanceKm);
      }
    };

    socket.on('request:updated', onRequestUpdated);
    socket.on('request:location_updated', onRequestLocationUpdated);

    // Load garages for map pin overlays
    api
      .get<{ garages: any[] }>('/garages')
      .then((res) => {
        if (res.garages) {
          setNearbyGarages(
            res.garages.map((g) => ({
              id: g.id,
              name: g.name,
              lat: g.latitude || 26.4735,
              lng: g.longitude || 80.3075,
              phone: g.phone,
              address: g.address,
              operatingHours: g.operatingHours,
              acceptsEmergency: g.acceptsEmergency,
            }))
          );
        }
      })
      .catch(() => {});

    return () => {
      socket.emit('request:leave', id);
      socket.off('request:updated', onRequestUpdated);
      socket.off('request:location_updated', onRequestLocationUpdated);
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
      fetchAssignmentHistory();
    } catch (err: any) {
      error(err.message || 'Failed to assign mechanic');
    } finally {
      setAssigning(false);
    }
  };

  const handleOpenReassignModal = async () => {
    setReassignModalOpen(true);
    setLoadingEligible(true);
    setReassignMechanicId('');
    setReassignReason('');
    try {
      const res = await api.get<any>(`/admin/requests/${id}/eligible-mechanics`);
      setReassignEligibility(res);
      setEligibleMechanics(res.eligibleMechanics || []);
      if (res.eligibleMechanics && res.eligibleMechanics.length > 0) {
        setReassignMechanicId(res.eligibleMechanics[0].mechanicId);
      }
    } catch (err: any) {
      error(err.message || 'Failed to fetch eligible mechanics for reassignment');
    } finally {
      setLoadingEligible(false);
    }
  };

  const handleConfirmReassign = async () => {
    if (!reassignMechanicId) {
      error('Please select a replacement mechanic');
      return;
    }
    if (!reassignReason || reassignReason.trim().length < 5) {
      error('Please enter a reassignment reason of at least 5 characters');
      return;
    }

    try {
      setReassigning(true);
      const res = await api.post<any>(`/admin/requests/${id}/reassign`, {
        newMechanicId: reassignMechanicId,
        reason: reassignReason.trim(),
        expectedUpdatedAt: request.updatedAt,
      });

      success(res.message || 'Mechanic successfully reassigned!');
      setRequest(res.request);
      setReassignModalOpen(false);
      fetchAssignmentHistory();
    } catch (err: any) {
      error(err.message || 'Failed to reassign mechanic');
    } finally {
      setReassigning(false);
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
  const canReassign = request.status === 'ASSIGNED';
  const inspectionStarted = !['SUBMITTED', 'ASSIGNED'].includes(request.status);

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
              Customer: {request.customer?.name || 'Customer'} ({request.customer?.phone || 'No phone'}) | Garage: {request.garage?.name || 'Garage'}
            </p>
          </div>

          {canReassign && (
            <button
              onClick={handleOpenReassignModal}
              className="px-4 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 text-brand-orange" /> Reassign Mechanic
            </button>
          )}
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
                  Filtered by certified skill match, verified garage in {request.garage?.city || 'Kanpur'}, and availability.
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

        {/* Live Technician Route Tracking & GPS Monitoring */}
        {request.mechanic && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    Live Dispatch Telemetry
                  </span>
                </div>
                <h3 className="text-base font-black text-navy-900 flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-brand-orange" />
                  Technician Live Journey &amp; Workshop Proximity
                </h3>
                <p className="text-xs text-slate-500">
                  Tracking certified technician <strong>{request.mechanic.name}</strong> from <strong>{request.garage?.name}</strong>.
                </p>
              </div>

              {liveEtaMinutes !== undefined && (
                <div className="px-4 py-2 rounded-xl bg-orange-50 border border-orange-200 text-right">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Estimated Transit</span>
                  <span className="text-sm font-black text-brand-orange">~{liveEtaMinutes} mins ({liveDistanceKm || 0} km)</span>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-inner">
              <LiveTrackingMap
                customerLocation={{
                  lat: 26.4499,
                  lng: 80.3319,
                }}
                mechanicLocation={
                  mechanicLocation || {
                    lat: request.garage?.latitude || 26.4735,
                    lng: request.garage?.longitude || 80.3075,
                  }
                }
                garageLocation={{
                  lat: request.garage?.latitude || 26.4735,
                  lng: request.garage?.longitude || 80.3075,
                }}
                nearbyGarages={nearbyGarages}
                routeEtaMinutes={liveEtaMinutes}
                routeDistanceKm={liveDistanceKm}
                height="380px"
                zoom={14}
                showFilters={true}
              />
            </div>
          </div>
        )}

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
                    {request.vehicle?.make || 'Vehicle'} {request.vehicle?.model || ''}
                  </h4>
                  <p className="text-xs font-mono font-bold text-brand-orange">
                    {request.vehicle?.regNo || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Customer Details */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Customer Details
              </span>
              <p className="font-bold text-navy-900">{request.customer?.name || 'Customer'}</p>
              <p className="text-slate-600">Email: {request.customer?.email || 'N/A'}</p>
              <p className="text-slate-600">Phone: {request.customer?.phone || 'N/A'}</p>
            </div>

            {/* Assigned Mechanic & Reassignment Control */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Assigned Mechanic
                </span>
                {canReassign && (
                  <button
                    onClick={handleOpenReassignModal}
                    className="text-[11px] font-bold text-brand-orange hover:underline inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Reassign
                  </button>
                )}
              </div>

              {request.mechanic ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-navy-100 text-navy-900 font-bold flex items-center justify-center text-xs">
                      {request.mechanic.name?.[0] || 'M'}
                    </div>
                    <div>
                      <p className="font-bold text-navy-900">{request.mechanic.name || 'Mechanic'}</p>
                      <p className="text-[11px] text-slate-500">{request.mechanic.phone || 'No phone'}</p>
                    </div>
                  </div>

                  {inspectionStarted ? (
                    <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 flex items-start gap-2">
                      <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Reassignment locked:</strong> Vehicle inspection in progress or completed. Technical chain of custody is locked.
                      </span>
                    </div>
                  ) : canReassign ? (
                    <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-[11px] text-emerald-800 flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        Assigned. Inspection has not commenced. Admin reassignment is permitted.
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="text-amber-600 font-bold">No mechanic currently assigned.</span>
                  <p className="text-[11px] text-slate-500">
                    Use the smart recommendation panel above to assign a certified technician.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Technician Assignment History Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-brand-orange" />
              <h3 className="text-sm font-extrabold text-navy-900">
                Technician Assignment & Reassignment History ({assignmentHistory.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              Audit logged & immutable
            </span>
          </div>

          {assignmentHistory.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
              No formal assignment records logged yet.
            </div>
          ) : (
            <div className="space-y-3">
              {assignmentHistory.map((hist: any, idx: number) => {
                const isReassignment = !!hist.previousMechanic;
                return (
                  <div
                    key={hist.id || idx}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors text-xs space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                            isReassignment
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {isReassignment ? 'Mechanic Reassigned' : 'Initial Assignment'}
                        </span>
                        <span className="text-slate-400">|</span>
                        <span className="font-semibold text-navy-900">
                          {formatDate(hist.assignedAt)}
                        </span>
                      </div>

                      <span className="text-[11px] text-slate-500">
                        Executed by: <strong>{hist.assignedBy?.name || 'Administrator'}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-medium text-navy-900 pt-1">
                      {isReassignment && (
                        <>
                          <span className="text-slate-500 line-through">
                            {hist.previousMechanic?.name || 'Previous Tech'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-brand-orange shrink-0" />
                        </>
                      )}
                      <span className="font-bold text-brand-orange">
                        {hist.newMechanic?.name || 'New Tech'}
                      </span>
                    </div>

                    {hist.reason && (
                      <p className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 italic">
                        "{hist.reason}"
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Reassignment Modal */}
      {reassignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setReassignModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
                <RefreshCw className="w-3.5 h-3.5" /> Technician Reassignment
              </div>
              <h2 className="text-xl font-black text-navy-900">
                Reassign Vehicle: {request.requestNumber}
              </h2>
              <p className="text-xs text-slate-500">
                Currently assigned to: <strong>{request.mechanic?.name || 'None'}</strong>. Reassignment is valid only before vehicle inspection commences.
              </p>
            </div>

            {loadingEligible ? (
              <div className="py-8 text-center space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin text-brand-orange mx-auto" />
                <p className="text-xs text-slate-500">Evaluating certified mechanics & workload availability...</p>
              </div>
            ) : eligibleMechanics.length === 0 ? (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  No other active mechanics available
                </div>
                <p className="text-[11px] text-amber-800">
                  {reassignEligibility?.disallowReason ||
                    'There are currently no other verified mechanics with matching skills marked as AVAILABLE.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-navy-900 block mb-1.5">
                    Select Replacement Mechanic *
                  </label>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {eligibleMechanics.map((mech) => {
                      const isSelected = reassignMechanicId === mech.mechanicId;
                      return (
                        <div
                          key={mech.mechanicId}
                          onClick={() => setReassignMechanicId(mech.mechanicId)}
                          className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-orange-50/50 border-brand-orange ring-1 ring-brand-orange'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-navy-900">{mech.name}</span>
                            <span className="text-[11px] font-mono font-bold text-brand-orange">
                              ★ {mech.rating.toFixed(1)} | Score: {mech.score.toFixed(1)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                            <span>{mech.garageName}</span>
                            <span>Active Jobs: {mech.activeJobCount}</span>
                          </div>
                          {mech.reasons && mech.reasons.length > 0 && (
                            <p className="text-[10px] text-emerald-700 mt-1">
                              ✓ {mech.reasons.join(' • ')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-navy-900 block mb-1">
                    Reassignment Reason (Mandatory, min 5 chars) *
                  </label>
                  <textarea
                    rows={3}
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    placeholder="e.g. Previous mechanic called in sick / Specialized diesel engine diagnostic required"
                    className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-brand-orange/40"
                  />
                  <span className="text-[10px] text-slate-400">
                    Characters: {reassignReason.trim().length} / min 5
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                  <span>
                    Confirming reassignment will update the assignment record, notify both the previous and replacement mechanic in real-time, and record an immutable audit log.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setReassignModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={
                      reassigning ||
                      !reassignMechanicId ||
                      reassignReason.trim().length < 5
                    }
                    onClick={handleConfirmReassign}
                    className="px-6 py-2.5 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-extrabold shadow-md shadow-brand-orange/20 transition-all disabled:opacity-50"
                  >
                    {reassigning ? 'Reassigning...' : 'Confirm Reassignment'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
