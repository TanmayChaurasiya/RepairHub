'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  PhoneCall,
  MapPin,
  Navigation,
  Car,
  Bike,
  Truck,
  Wrench,
  Clock,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Upload,
  RefreshCw,
  Search,
  ArrowRight,
  Flame,
  BatteryCharging,
  Disc,
  Fuel,
  HelpCircle,
  ChevronRight,
  User,
} from 'lucide-react';
import { AppLayout } from '../../../components/layout/AppLayout';
import { api } from '../../../lib/api';
import { getSocket } from '../../../lib/socket';
import { useToast } from '../../../context/ToastContext';

// Dynamic import for Leaflet map to disable SSR
const EmergencyMap = dynamic(() => import('../../../components/emergency/EmergencyMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[380px] rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-bold text-slate-500">Loading Satellite Map...</span>
      </div>
    </div>
  ),
});

const EMERGENCY_CATEGORIES = [
  { id: 'FLAT_TYRE', label: 'Flat Tyre / Puncture', icon: Disc, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'BATTERY_FAILURE', label: 'Battery Failure / Jumpstart', icon: BatteryCharging, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'ENGINE_OVERHEATING', label: 'Engine Overheating', icon: Flame, color: 'text-red-600 bg-red-50 border-red-200' },
  { id: 'VEHICLE_BREAKDOWN', label: 'Vehicle Breakdown', icon: ShieldAlert, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { id: 'ENGINE_PROBLEMS', label: 'Engine Problems', icon: Wrench, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { id: 'FUEL_RELATED', label: 'Fuel-related Issues', icon: Fuel, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { id: 'TOWING_ASSISTANCE', label: 'Towing Assistance', icon: Truck, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { id: 'OTHER', label: 'Other Roadside Issue', icon: HelpCircle, color: 'text-slate-600 bg-slate-50 border-slate-200' },
];

export default function CustomerEmergencyPage() {
  const { success, error, info } = useToast();

  // Location State
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState('');
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsError, setGpsError] = useState('');

  // Form State
  const [category, setCategory] = useState<string>('FLAT_TYRE');
  const [description, setDescription] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [customerVehicles, setCustomerVehicles] = useState<any[]>([]);
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Discovery State
  const [nearbyProviders, setNearbyProviders] = useState<any[]>([]);
  const [searchRadius, setSearchRadius] = useState<number>(15);
  const [searchingProviders, setSearchingProviders] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);

  // Active Incident State
  const [submitting, setSubmitting] = useState(false);
  const [activeRequest, setActiveRequest] = useState<any | null>(null);
  const [mechanicLiveCoords, setMechanicLiveCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [liveDistanceKm, setLiveDistanceKm] = useState<number | undefined>();
  const [liveEtaMinutes, setLiveEtaMinutes] = useState<number | undefined>();
  const [cancelling, setCancelling] = useState(false);

  // Auto-detect GPS on initial load
  useEffect(() => {
    detectLocation();
    fetchCustomerVehicles();
    checkExistingActiveRequest();
  }, []);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser. Please tap on the map to set your location.');
      setCoords({ lat: 26.4499, lng: 80.3319 }); // Fallback to central Kanpur
      return;
    }

    setDetectingGps(true);
    setGpsError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const detected = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(detected);
        setDetectingGps(false);
        // Reverse geocode simple label
        setAddress(`Near GPS Coordinates (${detected.lat.toFixed(4)}, ${detected.lng.toFixed(4)})`);
      },
      (err) => {
        setDetectingGps(false);
        setGpsError('GPS permission was denied or unavailable. Tap on the map to manually set your breakdown spot.');
        setCoords({ lat: 26.4499, lng: 80.3319 }); // Fallback
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const fetchCustomerVehicles = async () => {
    try {
      const res = await api.get<{ vehicles: any[] }>('/vehicles');
      setCustomerVehicles(res.vehicles || []);
      if (res.vehicles && res.vehicles.length > 0) {
        setVehicleId(res.vehicles[0].id);
      }
    } catch (err: any) {
      console.warn('Could not load vehicles:', err?.message);
    }
  };

  const checkExistingActiveRequest = async () => {
    try {
      const res = await api.get<{ requests?: any[]; items?: any[] }>('/emergency/requests');
      const list = res.requests || res.items || [];
      const active = list.find(
        (r) =>
          r.status !== 'COMPLETED' &&
          r.status !== 'CANCELLED' &&
          r.status !== 'UNFULFILLED'
      );
      if (active) {
        setActiveRequest(active);
        setCoords({
          lat: active.pickupLatitude ?? active.latitude ?? 26.4499,
          lng: active.pickupLongitude ?? active.longitude ?? 80.3319,
        });
        if (active.assignedMechanic || active.mechanicProfile) {
          const mLat = active.mechanicLatitude ?? active.mechanicProfile?.latitude ?? 26.4735;
          const mLon = active.mechanicLongitude ?? active.mechanicProfile?.longitude ?? 80.3075;
          setMechanicLiveCoords({
            lat: mLat,
            lng: mLon,
          });
          setLiveDistanceKm(active.distanceKm ?? active.estimatedDistanceKm);
          setLiveEtaMinutes(active.estimatedArrivalMinutes ?? active.estimatedDurationMinutes);
        }
      }
    } catch (err) {
      // Ignore if no active requests
    }
  };

  // Discover nearby providers when coords change
  const discoverNearbyProviders = useCallback(async () => {
    if (!coords) return;
    try {
      setSearchingProviders(true);
      const selectedVehicle = customerVehicles.find((v) => v.id === vehicleId);
      const vehicleType = selectedVehicle?.type || 'CAR';

      const res = await api.get<{ providers: any[] }>(
        `/emergency/nearby?lat=${coords.lat}&lng=${coords.lng}&radius=${searchRadius}&vehicleType=${vehicleType}`
      );
      setNearbyProviders(res.providers || []);
    } catch (err: any) {
      console.error('Failed to discover nearby providers:', err?.message);
    } finally {
      setSearchingProviders(false);
    }
  }, [coords, searchRadius, vehicleId, customerVehicles]);

  useEffect(() => {
    if (coords && !activeRequest) {
      discoverNearbyProviders();
    }
  }, [coords, searchRadius, vehicleId, activeRequest, discoverNearbyProviders]);

  // Socket.IO real-time event listeners for active emergency
  useEffect(() => {
    if (!activeRequest) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit('emergency:join', activeRequest.id);

    const onAccepted = (data: any) => {
      const reqId = data.requestId || data.emergencyId;
      if (reqId === activeRequest.id) {
        success(`Mechanic ${data.mechanicName || 'Technician'} assigned to your emergency!`);
        setActiveRequest((prev: any) => ({
          ...prev,
          status: 'ACCEPTED',
          assignedMechanic: {
            id: data.assignedMechanicId,
            name: data.mechanicName,
            phone: data.mechanicPhone,
          },
          garage: {
            name: data.garageName,
          },
        }));
        if (data.mechanicLocation) {
          setMechanicLiveCoords(data.mechanicLocation);
        }
        if (data.etaMinutes) setLiveEtaMinutes(data.etaMinutes);
        if (data.distanceKm) setLiveDistanceKm(data.distanceKm);
      }
    };

    const onStatusUpdated = (data: any) => {
      const reqId = data.requestId || data.emergencyId;
      if (reqId === activeRequest.id) {
        setActiveRequest((prev: any) => ({ ...prev, status: data.status }));
        if (data.status === 'COMPLETED') {
          success('Emergency roadside service has been successfully completed.');
        } else if (data.status === 'EN_ROUTE') {
          info(`Technician is now en route to your breakdown location!`);
        } else if (data.status === 'ARRIVED') {
          info(`Technician has arrived at your location!`);
        }
      }
    };

    const onLocationUpdated = (data: any) => {
      const reqId = data.requestId || data.emergencyId;
      if (reqId === activeRequest.id) {
        setMechanicLiveCoords({ lat: data.latitude ?? data.lat, lng: data.longitude ?? data.lng });
        setLiveEtaMinutes(data.estimatedArrivalMinutes ?? data.etaMinutes);
        setLiveDistanceKm(data.distanceKm ?? data.remainingDistanceKm);
      }
    };

    const onCancelled = (data: any) => {
      const reqId = data.requestId || data.emergencyId;
      if (reqId === activeRequest.id) {
        info(`Emergency request cancelled: ${data.reason}`);
        setActiveRequest(null);
      }
    };

    socket.on('emergency:accepted', onAccepted);
    socket.on('emergency:status_updated', onStatusUpdated);
    socket.on('emergency:location_updated', onLocationUpdated);
    socket.on('emergency:cancelled', onCancelled);

    return () => {
      socket.emit('emergency:leave', activeRequest.id);
      socket.off('emergency:accepted', onAccepted);
      socket.off('emergency:status_updated', onStatusUpdated);
      socket.off('emergency:location_updated', onLocationUpdated);
      socket.off('emergency:cancelled', onCancelled);
    };
  }, [activeRequest, success, info]);

  // Periodic background sync for active emergency
  useEffect(() => {
    if (!activeRequest || activeRequest.status === 'COMPLETED' || activeRequest.status === 'CANCELLED') return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get<{ emergency: any }>(`/emergency/requests/${activeRequest.id}`);
        if (res.emergency) {
          setActiveRequest(res.emergency);
          if (res.emergency.estimatedDurationMinutes) {
            setLiveEtaMinutes(res.emergency.estimatedDurationMinutes);
          }
          if (res.emergency.estimatedDistanceKm) {
            setLiveDistanceKm(res.emergency.estimatedDistanceKm);
          }
          if (res.emergency.mechanicLatitude && res.emergency.mechanicLongitude) {
            setMechanicLiveCoords({
              lat: res.emergency.mechanicLatitude,
              lng: res.emergency.mechanicLongitude,
            });
          }
        }
      } catch (e) {
        // quiet poll
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeRequest?.id, activeRequest?.status]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      error('Photo size should be less than 5MB');
      return;
    }

    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoUrl(reader.result as string);
      setUploadingPhoto(false);
      success('Breakdown photo attached.');
    };
    reader.onerror = () => {
      setUploadingPhoto(false);
      error('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleDispatchEmergency = async () => {
    if (!coords) {
      error('Please select or detect your current breakdown location.');
      return;
    }
    if (!vehicleId) {
      error('Please select the registered vehicle that broke down.');
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        vehicleId,
        category,
        description: description.trim() || undefined,
        latitude: coords.lat,
        longitude: coords.lng,
        pickupAddress: address || `GPS Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
        photoUrls: photoUrl ? [photoUrl] : [],
      };

      if (selectedProvider) {
        payload.preferredGarageId = selectedProvider.id;
      }

      const res = await api.post<{ emergency: any }>('/emergency/requests', payload);
      setActiveRequest(res.emergency);
      success(`Emergency SOS dispatched! ID: ${res.emergency.requestNumber}`);
    } catch (err: any) {
      error(err?.message || 'Failed to dispatch emergency request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEmergency = async () => {
    if (!activeRequest) return;
    const reason = prompt('Please enter the reason for cancellation (e.g. Vehicle restarted, arranged alternate help):');
    if (!reason || !reason.trim()) return;

    try {
      setCancelling(true);
      await api.post(`/emergency/requests/${activeRequest.id}/cancel`, { reason });
      success('Emergency assistance request cancelled.');
      setActiveRequest(null);
    } catch (err: any) {
      error(err?.message || 'Failed to cancel request');
    } finally {
      setCancelling(false);
    }
  };

  const getStatusStepIndex = (status?: string) => {
    switch (status) {
      case 'REQUESTED':
      case 'SEARCHING':
        return 1;
      case 'PENDING_ACCEPTANCE':
        return 2;
      case 'ACCEPTED':
        return 3;
      case 'EN_ROUTE':
        return 4;
      case 'ARRIVED':
        return 5;
      case 'IN_PROGRESS':
        return 6;
      case 'COMPLETED':
        return 7;
      default:
        return 0;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* CRITICAL SAFETY ADVISORY ALERT BANNER */}
        <div className="bg-red-950 text-white p-4 sm:p-5 rounded-2xl border-2 border-red-600 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-md animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-black tracking-wide uppercase text-red-200 flex items-center gap-2">
                Critical Safety Advisory &bull; Immediate Danger Warning
              </h2>
              <p className="text-xs text-red-100 max-w-3xl leading-relaxed">
                If you are on an active highway or in a hazardous blind turn, <strong>turn on your hazard lights, exit the vehicle immediately if safe, and stand behind the highway barrier away from oncoming traffic.</strong> Roadside assistance is not a replacement for government first responders.
              </p>
            </div>
          </div>

          <a
            href="tel:112"
            className="w-full md:w-auto px-5 py-3 rounded-xl bg-white text-red-700 hover:bg-red-50 text-xs font-black shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 shrink-0"
          >
            <PhoneCall className="w-4 h-4 text-red-600" />
            Call Emergency (112)
          </a>
        </div>

        {/* ========================================================= */}
        {/* ACTIVE INCIDENT TRACKER VIEW                              */}
        {/* ========================================================= */}
        {activeRequest ? (
          <div className="space-y-6">
            {/* Live Status Header */}
            <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-navy-800">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-navy-800/80">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    Live Emergency Response Active
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    SOS Incident #{activeRequest.requestNumber}
                  </h1>
                  <p className="text-xs text-slate-300">
                    Category: <strong>{activeRequest.category}</strong> &bull; Vehicle: <strong>{activeRequest.vehicle?.make} {activeRequest.vehicle?.model} ({activeRequest.vehicle?.regNo})</strong>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCancelEmergency}
                    disabled={cancelling}
                    className="px-4 py-2.5 rounded-xl bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-700 text-xs font-bold transition-all"
                  >
                    {cancelling ? 'Cancelling...' : 'Cancel Request'}
                  </button>
                </div>
              </div>

              {/* Progress Steps */}
              <div className="pt-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {[
                    { title: 'Dispatched', desc: 'Request logged', step: 1 },
                    { title: 'Searching', desc: 'Alerting mechanics', step: 2 },
                    { title: 'Accepted', desc: 'Mechanic confirmed', step: 3 },
                    { title: 'En Route', desc: 'Traveling to you', step: 4 },
                    { title: 'Arrived', desc: 'On-site arrival', step: 5 },
                    { title: 'Repaired', desc: 'Service completed', step: 7 },
                  ].map((s) => {
                    const currentStep = getStatusStepIndex(activeRequest.status);
                    const isDone = currentStep >= s.step;
                    const isCurrent = currentStep === s.step || (s.step === 2 && currentStep === 1);

                    return (
                      <div
                        key={s.step}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          isDone
                            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                            : isCurrent
                            ? 'bg-brand-orange/20 border-brand-orange text-white ring-2 ring-brand-orange/30'
                            : 'bg-navy-900/60 border-navy-800 text-slate-500'
                        }`}
                      >
                        <p className="text-xs font-black">{s.title}</p>
                        <p className="text-[10px] mt-0.5 opacity-80">{s.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Live GPS Map & Technician Details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Map Column */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-navy-900 flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-brand-orange" />
                      Live Technician Route Tracking
                    </h3>
                    {liveEtaMinutes !== undefined && (
                      <span className="text-xs font-bold text-navy-900 bg-orange-50 text-brand-orange border border-orange-200 px-3 py-1 rounded-full">
                        ETA: ~{liveEtaMinutes} mins
                      </span>
                    )}
                  </div>

                  <EmergencyMap
                    customerLocation={coords}
                    mechanicLocation={mechanicLiveCoords}
                    routeEtaMinutes={liveEtaMinutes}
                    routeDistanceKm={liveDistanceKm}
                    height="420px"
                    zoom={15}
                  />

                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    Breakdown Location: <span className="font-semibold text-navy-900">{activeRequest.pickupAddress}</span>
                  </p>
                </div>
              </div>

              {/* Technician & Dispatch Details */}
              <div className="space-y-4">
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
                  <h3 className="text-sm font-black text-navy-900 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-blue-600" />
                    Assigned Technician
                  </h3>

                  {activeRequest.assignedMechanic || activeRequest.mechanicProfile ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-lg border border-blue-200">
                          {(activeRequest.assignedMechanic?.name || activeRequest.mechanicProfile?.user?.name || 'M').charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-navy-900">
                            {activeRequest.assignedMechanic?.name || activeRequest.mechanicProfile?.user?.name || 'Assigned Mechanic'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {activeRequest.garage?.name || activeRequest.mechanicProfile?.garage?.name || 'Kanpur Certified Garage'}
                          </p>
                        </div>
                      </div>

                      {(activeRequest.assignedMechanic?.phone || activeRequest.mechanicProfile?.user?.phone) && (
                        <a
                          href={`tel:${activeRequest.assignedMechanic?.phone || activeRequest.mechanicProfile?.user?.phone}`}
                          className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
                        >
                          <PhoneCall className="w-4 h-4" />
                          Call Technician ({activeRequest.assignedMechanic?.phone || activeRequest.mechanicProfile?.user?.phone})
                        </a>
                      )}

                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Status:</span>
                          <span className="font-bold text-navy-900">{activeRequest.status}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Remaining Distance:</span>
                          <span className="font-bold text-navy-900">
                            {liveDistanceKm ? `${liveDistanceKm} km` : 'Calculating...'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Estimated Arrival:</span>
                          <span className="font-bold text-brand-orange">
                            {liveEtaMinutes ? `~${liveEtaMinutes} minutes` : 'Calculating...'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <div className="w-10 h-10 border-4 border-brand-orange border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-xs font-bold text-navy-900">Routing to nearest available mechanic...</p>
                      <p className="text-[11px] text-slate-500">
                        Broadcasting to authorized mechanics within {searchRadius}km radius.
                      </p>
                    </div>
                  )}
                </div>

                {/* Roadside Safety Reminders */}
                <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 space-y-2 text-xs text-amber-900">
                  <h4 className="font-bold flex items-center gap-1.5 text-amber-950">
                    <ShieldAlert className="w-4 h-4 text-amber-700" />
                    While you wait:
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 text-[11px]">
                    <li>Keep hazard warning flashers ON.</li>
                    <li>If parked on road, place safety triangle 50m behind car.</li>
                    <li>Stay on passenger side away from traffic.</li>
                    <li>Keep your mobile phone line free for technician calls.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* REQUEST EMERGENCY DISPATCH VIEW                           */
          /* ========================================================= */
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-red-950 via-navy-950 to-red-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-red-900 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/30 text-red-400 border border-red-500/30 text-xs font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" /> 24x7 Kanpur Roadside Support
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Emergency Assistance &bull; Instant Dispatch
                </h1>
                <p className="text-xs text-slate-300 max-w-2xl">
                  Stranded with a breakdown or flat tyre? Request immediate mechanic dispatch with live GPS tracking, verified nearby workshops, and guaranteed technician arrival.
                </p>
              </div>

              <button
                onClick={detectLocation}
                disabled={detectingGps}
                className="px-5 py-3 rounded-2xl bg-white text-navy-950 hover:bg-slate-100 text-xs font-black shadow-lg flex items-center justify-center gap-2 transition-all shrink-0"
              >
                <RefreshCw className={`w-4 h-4 text-red-600 ${detectingGps ? 'animate-spin' : ''}`} />
                {detectingGps ? 'Detecting GPS...' : 'Re-detect Location'}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Form & Problem Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* 1. Problem Category Selector */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black text-navy-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-xs font-black">
                        1
                      </span>
                      Select Emergency Issue
                    </h2>
                    <span className="text-xs text-slate-400">Choose primary cause</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {EMERGENCY_CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = category === cat.id;

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategory(cat.id)}
                          className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all ${
                            isSelected
                              ? 'bg-red-50 border-red-500 shadow-md ring-2 ring-red-400/30'
                              : 'bg-white hover:bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center ${cat.color}`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <p
                            className={`text-xs font-bold ${
                              isSelected ? 'text-red-950' : 'text-navy-900'
                            }`}
                          >
                            {cat.label}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Problem Description */}
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Describe the situation or symptoms (optional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Engine started smoking, strange noise from rear tyre, battery completely dead..."
                      rows={2}
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs text-navy-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    />
                  </div>

                  {/* Photo Upload */}
                  <div className="pt-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Breakdown Photo (optional)
                    </label>
                    <div className="flex items-center gap-4">
                      <label className="cursor-pointer px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-2 transition-colors">
                        <Upload className="w-4 h-4 text-slate-500" />
                        {uploadingPhoto ? 'Processing...' : 'Upload Photo'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>
                      {photoUrl && (
                        <div className="flex items-center gap-2 text-xs text-emerald-600 font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                          Photo attached
                          <button
                            type="button"
                            onClick={() => setPhotoUrl('')}
                            className="text-red-500 text-[11px] underline ml-1"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Breakdown Location & Interactive Map */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black text-navy-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-xs font-black">
                        2
                      </span>
                      Confirm Breakdown Location
                    </h2>
                    <span className="text-xs text-slate-400">Click map to adjust pin</span>
                  </div>

                  {gpsError && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      {gpsError}
                    </div>
                  )}

                  <EmergencyMap
                    customerLocation={coords}
                    nearbyGarages={nearbyProviders.map((p) => ({
                      id: p.id,
                      name: p.name,
                      lat: p.latitude,
                      lng: p.longitude,
                      phone: p.phone,
                      rating: p.rating,
                    }))}
                    editable={true}
                    onLocationSelect={(newCoords) => {
                      setCoords(newCoords);
                      setAddress(`Selected Location (${newCoords.lat.toFixed(4)}, ${newCoords.lng.toFixed(4)})`);
                    }}
                    height="320px"
                  />

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Landmark / Street Address
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Near Mall Mile, Kanpur bypass road"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-navy-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Vehicle Selection & Dispatch Button */}
              <div className="space-y-6">
                {/* 3. Vehicle Picker */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <h2 className="text-sm font-black text-navy-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-xs font-black">
                      3
                    </span>
                    Select Affected Vehicle
                  </h2>

                  {customerVehicles.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center space-y-2">
                      <Car className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-xs font-bold text-navy-900">No Vehicles Registered</p>
                      <p className="text-[11px] text-slate-500">
                        Please register a vehicle in your profile before requesting assistance.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {customerVehicles.map((v) => (
                        <label
                          key={v.id}
                          className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                            vehicleId === v.id
                              ? 'bg-blue-50/60 border-blue-500 ring-2 ring-blue-400/20'
                              : 'bg-white hover:bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="vehicle"
                              checked={vehicleId === v.id}
                              onChange={() => setVehicleId(v.id)}
                              className="text-brand-orange focus:ring-brand-orange"
                            />
                            <div>
                              <p className="text-xs font-bold text-navy-900">
                                {v.make} {v.model} ({v.year})
                              </p>
                              <span className="text-[11px] font-mono font-bold text-slate-500">
                                {v.regNo}
                              </span>
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            {v.type || 'CAR'}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Nearby Providers Discovery Card */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-navy-900 flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-brand-orange" />
                      Available Workshops ({nearbyProviders.length})
                    </h3>
                    <select
                      value={searchRadius}
                      onChange={(e) => setSearchRadius(Number(e.target.value))}
                      className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1"
                    >
                      <option value={10}>Within 10 km</option>
                      <option value={15}>Within 15 km</option>
                      <option value={25}>Within 25 km</option>
                      <option value={40}>Within 40 km</option>
                    </select>
                  </div>

                  {searchingProviders ? (
                    <div className="p-4 text-center space-y-2">
                      <div className="w-6 h-6 border-2 border-brand-orange border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-xs text-slate-500">Scanning Kanpur providers...</p>
                    </div>
                  ) : nearbyProviders.length === 0 ? (
                    <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
                      No workshop found in {searchRadius}km radius. Radius will expand automatically upon dispatch.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {nearbyProviders.slice(0, 3).map((p) => (
                        <div
                          key={p.id}
                          onClick={() => setSelectedProvider(selectedProvider?.id === p.id ? null : p)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all text-xs ${
                            selectedProvider?.id === p.id
                              ? 'bg-orange-50 border-brand-orange ring-1 ring-brand-orange'
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-navy-900">{p.name}</span>
                            <span className="text-[11px] font-semibold text-brand-orange">
                              {p.distanceKm} km away
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                            <span>ETA: ~{p.estimatedArrivalMinutes} mins</span>
                            <span className="text-emerald-600 font-bold">
                              {p.availableMechanicsCount} active tech{p.availableMechanicsCount > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Instant SOS Dispatch Button */}
                <button
                  type="button"
                  onClick={handleDispatchEmergency}
                  disabled={submitting || !vehicleId || !coords}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-red-600 hover:from-red-700 hover:to-red-700 text-white font-black text-sm tracking-wide uppercase shadow-xl shadow-red-600/30 flex items-center justify-center gap-2.5 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <AlertTriangle className={`w-5 h-5 ${submitting ? 'animate-spin' : ''}`} />
                  {submitting ? 'Dispatching Emergency SOS...' : 'Request Emergency Help (SOS)'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
