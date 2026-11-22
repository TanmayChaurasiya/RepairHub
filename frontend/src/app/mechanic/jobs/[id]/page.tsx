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
  Calculator,
  ArrowLeft,
  FileText,
  User,
  Phone,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Navigation,
  Radio,
  MapPin,
} from 'lucide-react';
import { AppLayout } from '../../../../components/layout/AppLayout';
import { StatusBadge } from '../../../../components/common/StatusBadge';
import { StatusTimeline } from '../../../../components/common/StatusTimeline';
import { CardSkeleton } from '../../../../components/common/LoadingSkeleton';
import { EstimateModal } from '../../../../components/modals/EstimateModal';
import { api } from '../../../../lib/api';
import { formatINR, formatDate } from '../../../../lib/utils';
import { getSocket } from '../../../../lib/socket';
import { useToast } from '../../../../context/ToastContext';

export default function MechanicJobDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [diagnosisText, setDiagnosisText] = useState('');
  const [transitionNote, setTransitionNote] = useState('');
  const [savingDiagnosis, setSavingDiagnosis] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [estimateModalOpen, setEstimateModalOpen] = useState(false);

  // Live Journey GPS Sharing States
  const [sharingLocation, setSharingLocation] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [routeEta, setRouteEta] = useState<number | null>(null);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);

  const { success, error } = useToast();

  const startJourney = () => {
    if (!navigator.geolocation) {
      error('Geolocation is not supported by this browser.');
      return;
    }

    const wid = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentCoords({ lat, lng });

        try {
          const res = await api.patch<any>(`/requests/${id}/location`, {
            latitude: lat,
            longitude: lng,
          });
          if (res.etaMinutes) setRouteEta(res.etaMinutes);
          if (res.remainingDistanceKm) setRouteDistance(res.remainingDistanceKm);
        } catch (e) {
          // ignore transient patch failure
        }
      },
      (err) => {
        console.warn('Geolocation watch error:', err.message);
        error('Could not access GPS. Please ensure location permissions are granted.');
        setSharingLocation(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 4000,
        timeout: 10000,
      }
    );

    setWatchId(wid);
    setSharingLocation(true);
    success('Live Journey started! GPS broadcast active for customer and workshop.');
  };

  const stopJourney = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setSharingLocation(false);
    success('Live Journey stopped.');
  };

  const fetchJob = async () => {
    try {
      setLoading(true);
      const data = await api.get<{ request: any }>(`/requests/${id}`);
      setJob(data.request);
      setDiagnosisText(data.request.diagnosis || '');
    } catch (err: any) {
      error(err.message || 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    fetchJob();

    const socket = getSocket();
    if (!socket) return;

    socket.emit('request:join', id);

    const onRequestUpdated = (updated: any) => {
      if (updated.id === id) {
        setJob((prev: any) => ({
          ...prev,
          ...updated,
          customer: updated.customer || prev?.customer,
          vehicle: updated.vehicle || prev?.vehicle,
          estimates: updated.estimates || prev?.estimates,
          statusHistory: updated.statusHistory || prev?.statusHistory,
        }));
        success(`Live update: Request moved to ${updated.status}`);
      }
    };

    socket.on('request:updated', onRequestUpdated);
    return () => {
      socket.emit('request:leave', id);
      socket.off('request:updated', onRequestUpdated);
    };
  }, [id]);

  const handleSaveDiagnosis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (diagnosisText.trim().length < 5) {
      error('Please write a technical diagnosis with at least 5 characters.');
      return;
    }

    try {
      setSavingDiagnosis(true);
      await api.put(`/requests/${id}/diagnosis`, { diagnosis: diagnosisText.trim() });
      success('Diagnosis recorded in job card.');
      fetchJob();
    } catch (err: any) {
      error(err.message || 'Failed to save diagnosis');
    } finally {
      setSavingDiagnosis(false);
    }
  };

  const handleTransition = async (targetStatus: string) => {
    try {
      setTransitioning(true);
      const res = await api.post<any>(`/requests/${id}/transition`, {
        targetStatus,
        note: transitionNote.trim() || undefined,
      });

      success(`Job successfully moved to ${targetStatus}`);
      setJob(res.request);
      setTransitionNote('');
    } catch (err: any) {
      error(err.message || `Failed to transition to ${targetStatus}`);
    } finally {
      setTransitioning(false);
    }
  };

  const handleReopenEstimate = async () => {
    try {
      setTransitioning(true);
      const res = await api.post<any>(`/estimates/request/${id}/reopen`, {});
      success('Inspection reopened for estimate revision');
      setJob(res.request);
    } catch (err: any) {
      error(err.message || 'Failed to reopen estimate');
    } finally {
      setTransitioning(false);
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

  if (!job) {
    return (
      <AppLayout>
        <div className="p-8 text-center space-y-4">
          <p className="text-sm text-slate-500">Job not found or access denied.</p>
          <Link href="/mechanic" className="text-xs font-bold text-brand-orange hover:underline">
            Return to Bay
          </Link>
        </div>
      </AppLayout>
    );
  }

  const activeEstimate = job.estimates?.[0];
  const isApproved = job.status === 'APPROVED';
  const isInProgress = job.status === 'IN_PROGRESS';
  const isQC = job.status === 'QC';
  const isCompleted = job.status === 'COMPLETED' || job.status === 'PAID';

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Back Link & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              href="/mechanic"
              className="text-xs font-bold text-slate-500 hover:text-navy-900 inline-flex items-center gap-1.5 mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Assigned Jobs
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-navy-900 font-mono">
                Job Card: {job.requestNumber}
              </h1>
              <StatusBadge status={job.status} />
            </div>
            <p className="text-xs text-slate-500">
              Vehicle: {job.vehicle?.make || 'Vehicle'} {job.vehicle?.model || ''} ({job.vehicle?.regNo || 'N/A'})
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {job.status === 'ASSIGNED' && (
              <button
                disabled={transitioning}
                onClick={() => handleTransition('INSPECTING')}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 flex items-center gap-2 transition-all"
              >
                <Wrench className="w-4 h-4" /> Start Inspection
              </button>
            )}

            {job.status === 'INSPECTING' && (
              <button
                onClick={() => setEstimateModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold shadow-md shadow-brand-orange/20 flex items-center gap-2 transition-all"
              >
                <Calculator className="w-4 h-4" /> Build & Send Estimate
              </button>
            )}

            {(job.status === 'ESTIMATE_SENT' || job.status === 'REJECTED') && (
              <button
                disabled={transitioning}
                onClick={handleReopenEstimate}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reopen to Revise Estimate
              </button>
            )}
          </div>
        </div>

        {/* 9-Stage Visual Progress Timeline */}
        <StatusTimeline
          currentStatus={job.status}
          history={job.statusHistory}
        />

        {/* Live Journey & GPS Tracking Broadcast */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${sharingLocation ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'}`} />
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  {sharingLocation ? 'Broadcasting Real-Time Location' : 'Satellite Journey Sharing'}
                </span>
              </div>
              <h3 className="text-base font-black text-navy-900 flex items-center gap-2">
                <Navigation className="w-5 h-5 text-brand-orange" />
                Live Mechanic Journey Sharing (Ola/Uber Style)
              </h3>
              <p className="text-xs text-slate-500">
                Share your real-time GPS location with customer and admin while traveling to customer or workshop.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {sharingLocation ? (
                <button
                  type="button"
                  onClick={stopJourney}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-md shadow-red-600/20 flex items-center gap-2 transition-all"
                >
                  <Radio className="w-4 h-4 animate-pulse" />
                  Stop Journey Broadcast
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startJourney}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-600/20 flex items-center gap-2 transition-all"
                >
                  <Navigation className="w-4 h-4" />
                  Start Journey &amp; Share GPS
                </button>
              )}
            </div>
          </div>

          {sharingLocation && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-emerald-600 animate-ping" />
                <span className="font-bold">
                  Satellite GPS Active: {currentCoords ? `${currentCoords.lat.toFixed(4)}, ${currentCoords.lng.toFixed(4)}` : 'Detecting...'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                {routeDistance !== null && (
                  <span>Remaining Distance: <strong>{routeDistance} km</strong></span>
                )}
                {routeEta !== null && (
                  <span>Estimated Arrival: <strong className="text-brand-orange">~{routeEta} mins</strong></span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Progress Stepper & Action Controls for Mechanic */}
        <div className="bg-navy-900 text-white rounded-3xl p-6 shadow-xl border border-navy-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-cyan block">
                Workflow Controller
              </span>
              <h3 className="text-base font-black text-white">Repair Execution Stage</h3>
            </div>

            {/* Note input for next stage */}
            <input
              type="text"
              placeholder="Optional transition note (e.g. Brake calipers torqued)..."
              value={transitionNote}
              onChange={(e) => setTransitionNote(e.target.value)}
              className="text-xs rounded-xl bg-navy-950 border border-navy-700 py-2 px-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 sm:w-80"
            />
          </div>

          <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Start Work Button */}
            <button
              disabled={!isApproved || transitioning}
              onClick={() => handleTransition('IN_PROGRESS')}
              className={`py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                isApproved
                  ? 'bg-brand-orange hover:bg-brand-orange-hover text-white shadow-lg shadow-brand-orange/30 animate-pulse'
                  : isInProgress || isQC || isCompleted
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 cursor-default'
                    : 'bg-navy-800 text-slate-500 border border-navy-750 cursor-not-allowed opacity-60'
              }`}
            >
              <Wrench className="w-4 h-4" />
              1. Start Work (In Progress)
            </button>

            {/* 2. Quality Check Button */}
            <button
              disabled={!isInProgress || transitioning}
              onClick={() => handleTransition('QC')}
              className={`py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                isInProgress
                  ? 'bg-brand-cyan hover:bg-brand-cyan-hover text-navy-950 shadow-lg shadow-brand-cyan/20 animate-pulse'
                  : isQC || isCompleted
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 cursor-default'
                    : 'bg-navy-800 text-slate-500 border border-navy-750 cursor-not-allowed opacity-60'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              2. Quality Check (QC)
            </button>

            {/* 3. Mark Completed Button */}
            <button
              disabled={!isQC || transitioning}
              onClick={() => handleTransition('COMPLETED')}
              className={`py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                isQC
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 animate-pulse'
                  : isCompleted
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 cursor-default'
                    : 'bg-navy-800 text-slate-500 border border-navy-750 cursor-not-allowed opacity-60'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              3. Mark Completed (QC Passed)
            </button>
          </div>

          {/* Strict Rule Notice */}
          {!isApproved && !isInProgress && !isQC && !isCompleted && (
            <div className="flex items-center gap-2 text-xs text-amber-300 pt-1">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              Strict Safety Lock: "Start Work" button unlocks automatically once customer approves the estimate.
            </div>
          )}
        </div>

        {/* Diagnosis & Vehicle Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Diagnosis Editor Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-navy-900 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-brand-orange" />
                  Technical Inspection & Diagnosis
                </h3>
              </div>

              <form onSubmit={handleSaveDiagnosis} className="space-y-3">
                <textarea
                  rows={4}
                  value={diagnosisText}
                  onChange={(e) => setDiagnosisText(e.target.value)}
                  placeholder="Record vehicle symptoms, error scan codes, physical wear, and required parts replacement..."
                  className="w-full text-xs rounded-xl border border-slate-300 p-3 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 resize-none"
                />

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingDiagnosis}
                    className="px-4 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {savingDiagnosis ? 'Saving Diagnosis...' : 'Save Diagnosis'}
                  </button>
                </div>
              </form>
            </div>

            {/* Estimates List Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-navy-900 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-brand-cyan" />
                  Estimate History ({job.estimates?.length || 0})
                </h3>
                {job.status === 'INSPECTING' && (
                  <button
                    onClick={() => setEstimateModalOpen(true)}
                    className="text-xs font-bold text-brand-orange hover:text-brand-orange-hover"
                  >
                    + Build Estimate
                  </button>
                )}
              </div>

              {!job.estimates || job.estimates.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-400 italic">
                  No estimate generated yet. Click "Build & Send Estimate" to price parts and labour.
                </div>
              ) : (
                <div className="space-y-4">
                  {job.estimates.map((est: any) => (
                    <div
                      key={est.id}
                      className={`p-4 rounded-xl border space-y-3 ${
                        est.status === 'APPROVED'
                          ? 'bg-emerald-50/40 border-emerald-300'
                          : est.status === 'SENT'
                            ? 'bg-amber-50/40 border-amber-300'
                            : est.status === 'REJECTED'
                              ? 'bg-rose-50/40 border-rose-300'
                              : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-navy-900">
                            Version #{est.version}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white border border-slate-300">
                            {est.status}
                          </span>
                        </div>
                        <span className="text-sm font-black text-navy-900">
                          {formatINR(est.totalPaise)}
                        </span>
                      </div>

                      {/* Items */}
                      <div className="divide-y divide-slate-100 text-xs">
                        {est.items?.map((item: any) => (
                          <div key={item.id} className="py-1.5 flex justify-between">
                            <span className="text-slate-700">
                              <span className="text-[10px] font-bold text-slate-400 mr-2">[{item.kind}]</span>
                              {item.description} (x{item.quantity})
                            </span>
                            <span className="font-semibold text-navy-900">
                              {formatINR(item.totalPaise)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {est.customerNote && (
                        <p className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-200">
                          <strong>Customer Note:</strong> {est.customerNote}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Customer Description & Photos */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-extrabold text-navy-900">Owner's Reported Problem</h3>
              <p className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200 leading-relaxed">
                "{job.description}"
              </p>

              {job.photos && job.photos.length > 0 && (
                <div className="pt-2">
                  <span className="text-xs font-bold text-slate-500 block mb-2">Uploaded Photos:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {job.photos.map((p: string, i: number) => (
                      <img
                        key={i}
                        src={p.startsWith('http') ? p : `http://localhost:5000${p}`}
                        alt="Vehicle fault"
                        className="rounded-xl border border-slate-200 object-cover aspect-video"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Vehicle Specs */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Vehicle in Bay
              </span>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-navy-900 text-white flex items-center justify-center font-bold">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-navy-900">
                    {job.vehicle?.make || 'Vehicle'} {job.vehicle?.model || ''}
                  </h4>
                  <p className="text-xs font-mono font-bold text-brand-orange">
                    {job.vehicle?.regNo || 'N/A'}
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Type:</span>
                  <strong className="text-navy-900">{job.vehicle?.type || 'N/A'}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Category:</span>
                  <strong className="text-navy-900">{job.category}</strong>
                </div>
              </div>
            </div>

            {/* Customer Contact */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Customer Details
              </span>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-navy-900">
                    {job.customer?.name || 'Customer'}
                  </h4>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {job.customer?.phone || 'No phone provided'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Estimate Builder Modal */}
      <EstimateModal
        requestId={job.id}
        isOpen={estimateModalOpen}
        onClose={() => setEstimateModalOpen(false)}
        onEstimateSent={(data) => {
          setJob(data.request);
        }}
      />
    </AppLayout>
  );
}
