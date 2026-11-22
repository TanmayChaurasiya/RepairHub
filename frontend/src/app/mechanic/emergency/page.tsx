'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  PhoneCall,
  MapPin,
  Navigation,
  Car,
  Wrench,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Radio,
  Flame,
  BatteryCharging,
  Disc,
  Truck,
  Fuel,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import { AppLayout } from '../../../components/layout/AppLayout';
import { api } from '../../../lib/api';
import { getSocket } from '../../../lib/socket';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';

// SSR-disabled dynamic Leaflet map
const EmergencyMap = dynamic(() => import('../../../components/emergency/EmergencyMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[380px] rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200">
      <div className="w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function MechanicEmergencyPage() {
  const { success, error, info } = useToast();

  const [acceptsEmergency, setAcceptsEmergency] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Mechanic GPS & Live Broadcast
  const [mechanicCoords, setMechanicCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isBroadcastingLocation, setIsBroadcastingLocation] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  // Status updating
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [resolvingIncident, setResolvingIncident] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');

  const { user } = useAuth();

  // Fetch active job and mechanic availability
  const fetchActiveJob = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{ requests: any[] }>('/emergency/requests');
      const all = res.requests || [];
      const currentActive = all.find(
        (r) =>
          r.assignedMechanicId === user?.id &&
          ['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(r.status)
      );
      const incoming = all.filter((r) =>
        ['REQUESTED', 'SEARCHING', 'PENDING_ACCEPTANCE'].includes(r.status)
      );
      setActiveJob(currentActive || null);
      setIncomingRequests(incoming);
    } catch (err: any) {
      console.warn('Could not load mechanic emergency view:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchActiveJob();

    // Get current location once on mount
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setMechanicCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn('Could not get initial mechanic coords:', err)
      );
    }
  }, [fetchActiveJob]);

  // Live GPS tracking when mechanic has an active en-route or arrived job
  useEffect(() => {
    if (!activeJob || activeJob.status === 'COMPLETED' || activeJob.status === 'CANCELLED') {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsBroadcastingLocation(false);
      return;
    }

    if (navigator.geolocation && (activeJob.status === 'EN_ROUTE' || activeJob.status === 'ACCEPTED')) {
      setIsBroadcastingLocation(true);

      watchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          const newCoords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setMechanicCoords(newCoords);

          // Push to backend
          try {
            await api.patch(`/emergency/requests/${activeJob.id}/location`, {
              latitude: newCoords.lat,
              longitude: newCoords.lng,
            });
          } catch (e) {
            // throttle errors
          }
        },
        (err) => console.warn('GPS watch error:', err),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
    }

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [activeJob]);

  // Socket.IO for new incoming dispatch alerts
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onEmergencyCreated = (data: any) => {
      // Add to incoming if not already active
      setIncomingRequests((prev) => [data, ...prev]);
      info(`🚨 Urgent Roadside Dispatch Alert: ${data.category} nearby!`);
    };

    socket.on('emergency:created', onEmergencyCreated);

    return () => {
      socket.off('emergency:created', onEmergencyCreated);
    };
  }, [info]);

  const handleToggleEmergencyAvailability = async () => {
    try {
      setToggleLoading(true);
      const nextState = !acceptsEmergency;
      await api.patch('/emergency/provider/settings', { acceptsEmergency: nextState });
      setAcceptsEmergency(nextState);
      success(`Roadside assistance status set to: ${nextState ? 'ONLINE & ACCEPTING' : 'OFFLINE'}`);
    } catch (err: any) {
      error(err?.message || 'Failed to update emergency settings');
    } finally {
      setToggleLoading(false);
    }
  };

  const handleAcceptJob = async (requestId: string) => {
    try {
      setLoading(true);
      const res = await api.post<{ emergency: any }>(`/emergency/requests/${requestId}/accept`, {});
      setActiveJob(res.emergency);
      setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
      success('Emergency assistance accepted! Customer alerted with your GPS location.');
    } catch (err: any) {
      error(err?.message || 'Failed to accept request. Another mechanic may have claimed it.');
      fetchActiveJob();
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineJob = async (requestId: string) => {
    const reason = prompt('Please enter a brief reason for declining (e.g. Too far, tool unavailable):') || 'Unavailable';
    try {
      await api.post(`/emergency/requests/${requestId}/decline`, { reason });
      setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
      info('Emergency request declined. Routed to next available technician.');
    } catch (err: any) {
      error(err?.message || 'Failed to decline request');
    }
  };

  const handleUpdateStatus = async (nextStatus: string, notes?: string) => {
    if (!activeJob) return;
    try {
      setUpdatingStatus(true);
      const res = await api.patch<{ emergency: any }>(`/emergency/requests/${activeJob.id}/status`, {
        targetStatus: nextStatus,
        note: notes,
      });
      setActiveJob(res.emergency);
      success(`Incident status updated: ${nextStatus}`);
      if (nextStatus === 'COMPLETED') {
        setActiveJob(null);
        setResolvingIncident(false);
      }
    } catch (err: any) {
      error(err?.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-navy-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold">
              <Radio className="w-3.5 h-3.5 animate-pulse" /> Roadside Response Terminal
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Emergency Technician Dispatch
            </h1>
            <p className="text-xs text-slate-300">
              Manage immediate roadside breakdowns, accept high-priority emergency alerts, and broadcast live transit GPS to stranded drivers.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-navy-900/80 p-3 rounded-2xl border border-navy-800">
            <div className="text-right">
              <p className="text-xs font-bold text-white">Emergency Duty</p>
              <p className="text-[10px] text-slate-400">
                {acceptsEmergency ? 'Accepting SOS dispatches' : 'Offline / Standby'}
              </p>
            </div>
            <button
              onClick={handleToggleEmergencyAvailability}
              disabled={toggleLoading}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                acceptsEmergency
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {toggleLoading ? 'Saving...' : acceptsEmergency ? 'ACTIVE' : 'STANDBY'}
            </button>
          </div>
        </div>

        {/* Incoming SOS Requests Modal / Alerts */}
        {incomingRequests.length > 0 && !activeJob && (
          <div className="bg-red-50 border-2 border-red-500 rounded-3xl p-6 shadow-xl space-y-4 animate-bounce-subtle">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-red-950 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 animate-ping" />
                Incoming Emergency Dispatches ({incomingRequests.length})
              </h2>
              <span className="text-xs font-bold text-red-700 bg-red-100 px-3 py-1 rounded-full">
                Action Required
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {incomingRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-white rounded-2xl p-5 border border-red-200 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-navy-950 font-mono">
                      #{req.requestNumber}
                    </span>
                    <span className="text-xs font-bold bg-red-50 text-red-600 border border-red-200 px-2.5 py-0.5 rounded-full">
                      {req.category}
                    </span>
                  </div>

                  <div className="text-xs text-navy-900 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5 text-slate-400" />
                      {req.vehicle?.make} {req.vehicle?.model} ({req.vehicle?.regNo})
                    </p>
                    <p className="text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-red-500" />
                      {req.pickupAddress}
                    </p>
                    {req.description && (
                      <p className="text-[11px] text-slate-600 italic bg-slate-50 p-2 rounded-lg">
                        &quot;{req.description}&quot;
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => handleAcceptJob(req.id)}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-colors"
                    >
                      Accept Job
                    </button>
                    <button
                      onClick={() => handleDeclineJob(req.id)}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ACTIVE JOB CONTROLLER */}
        {activeJob ? (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-orange-50 text-brand-orange border border-orange-200">
                      Active Emergency Job
                    </span>
                    {isBroadcastingLocation && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        Live GPS Broadcasting Active
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-black text-navy-950">
                    Incident #{activeJob.requestNumber} &bull; {activeJob.category}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Customer: <strong>{activeJob.customer?.name}</strong> &bull; Vehicle:{' '}
                    <strong>
                      {activeJob.vehicle?.make} {activeJob.vehicle?.model} ({activeJob.vehicle?.regNo})
                    </strong>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {activeJob.customer?.phone && (
                    <a
                      href={`tel:${activeJob.customer.phone}`}
                      className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-md"
                    >
                      <PhoneCall className="w-4 h-4" /> Call Driver
                    </a>
                  )}
                </div>
              </div>

              {/* Action Buttons for Next State */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-slate-500">Current Incident Stage:</span>
                  <p className="text-base font-black text-navy-900">{activeJob.status}</p>
                </div>

                <div className="flex items-center gap-3">
                  {activeJob.status === 'ACCEPTED' && (
                    <button
                      onClick={() => handleUpdateStatus('EN_ROUTE')}
                      disabled={updatingStatus}
                      className="px-5 py-3 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white font-black text-xs shadow-lg flex items-center gap-2"
                    >
                      <Navigation className="w-4 h-4" /> Start Journey (En Route)
                    </button>
                  )}

                  {activeJob.status === 'EN_ROUTE' && (
                    <button
                      onClick={() => handleUpdateStatus('ARRIVED')}
                      disabled={updatingStatus}
                      className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-lg flex items-center gap-2"
                    >
                      <MapPin className="w-4 h-4" /> Mark Arrived on Scene
                    </button>
                  )}

                  {activeJob.status === 'ARRIVED' && (
                    <button
                      onClick={() => handleUpdateStatus('IN_PROGRESS')}
                      disabled={updatingStatus}
                      className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-lg flex items-center gap-2"
                    >
                      <Wrench className="w-4 h-4" /> Begin Inspection &amp; Repair
                    </button>
                  )}

                  {activeJob.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => setResolvingIncident(true)}
                      className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-lg flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Complete Roadside Assistance
                    </button>
                  )}
                </div>
              </div>

              {/* Live Map */}
              <div className="space-y-3">
                <h3 className="text-sm font-black text-navy-900 flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-brand-orange" />
                  Navigation Route to Stranded Driver
                </h3>
                <EmergencyMap
                  customerLocation={{
                    lat: activeJob.pickupLatitude ?? activeJob.latitude ?? 26.4499,
                    lng: activeJob.pickupLongitude ?? activeJob.longitude ?? 80.3319,
                  }}
                  mechanicLocation={mechanicCoords}
                  height="400px"
                  zoom={15}
                />
              </div>
            </div>

            {/* Complete Job Modal */}
            {resolvingIncident && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                  <h3 className="text-base font-black text-navy-950 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Complete Roadside Service
                  </h3>
                  <p className="text-xs text-slate-500">
                    Confirm that the roadside problem has been resolved, vehicle tested, and driver advised.
                  </p>

                  <textarea
                    rows={3}
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder="Enter repair summary (e.g. Replaced flat tyre with spare, jumpstarted battery)..."
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs text-navy-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => setResolvingIncident(false)}
                      className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('COMPLETED', completionNotes)}
                      disabled={updatingStatus}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                    >
                      {updatingStatus ? 'Closing...' : 'Confirm Completed'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-12 text-center space-y-3 border border-slate-200 shadow-sm">
            <Wrench className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-navy-950">No Active Emergency Job</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You are currently online. When a driver nearby requests roadside assistance, you will receive an instant audio/visual dispatch alert here.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
