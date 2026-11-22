'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import 'leaflet/dist/leaflet.css';
import {
  Compass,
  Layers,
  MapPin,
  Wrench,
  Building2,
  ShieldAlert,
  Car,
  Bike,
  CheckCircle2,
  Clock,
  Phone,
} from 'lucide-react';

export interface MapCoordinates {
  lat: number;
  lng: number;
}

export interface MapGaragePin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  phone?: string;
  rating?: number;
  address?: string;
  services?: string[];
  category?: 'CAR' | 'TWO_WHEELER' | 'COMMERCIAL' | 'ALL' | string;
  operatingHours?: string;
  acceptsEmergency?: boolean;
  distanceKm?: number;
}

interface EmergencyMapProps {
  customerLocation?: MapCoordinates | null;
  mechanicLocation?: MapCoordinates | null;
  garageLocation?: MapCoordinates | null;
  nearbyGarages?: MapGaragePin[];
  editable?: boolean;
  onLocationSelect?: (coords: MapCoordinates) => void;
  height?: string;
  zoom?: number;
  routeEtaMinutes?: number;
  routeDistanceKm?: number;
  showFilters?: boolean;
}

export default function EmergencyMap({
  customerLocation,
  mechanicLocation,
  garageLocation,
  nearbyGarages = [],
  editable = false,
  onLocationSelect,
  height = '400px',
  zoom = 14,
  routeEtaMinutes,
  routeDistanceKm,
  showFilters = true,
}: EmergencyMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const leafletLibRef = useRef<any>(null);

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'CAR' | 'TWO_WHEELER' | 'EMERGENCY'>('ALL');
  const [showGarages, setShowGarages] = useState(true);

  // Filtered garages based on pill selection
  const filteredGarages = useMemo(() => {
    if (!showGarages) return [];
    if (activeFilter === 'ALL') return nearbyGarages;
    if (activeFilter === 'EMERGENCY') {
      return nearbyGarages.filter((g) => g.acceptsEmergency !== false);
    }
    if (activeFilter === 'TWO_WHEELER') {
      return nearbyGarages.filter((g) => {
        const cat = (g.category || '').toUpperCase();
        const serv = (g.services || []).join(' ').toUpperCase();
        return cat.includes('TWO') || cat.includes('BIKE') || serv.includes('BIKE') || serv.includes('TWO');
      });
    }
    if (activeFilter === 'CAR') {
      return nearbyGarages.filter((g) => {
        const cat = (g.category || '').toUpperCase();
        const serv = (g.services || []).join(' ').toUpperCase();
        return !cat.includes('TWO') || serv.includes('CAR') || serv.includes('SEDAN');
      });
    }
    return nearbyGarages;
  }, [nearbyGarages, activeFilter, showGarages]);

  useEffect(() => {
    let isMounted = true;

    // Dynamically load leaflet on client
    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;
      leafletLibRef.current = L;

      // Clean up previous instance if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const defaultCenter: [number, number] = customerLocation
        ? [customerLocation.lat, customerLocation.lng]
        : garageLocation
        ? [garageLocation.lat, garageLocation.lng]
        : mechanicLocation
        ? [mechanicLocation.lat, mechanicLocation.lng]
        : [26.4499, 80.3319]; // Default Kanpur, UP coords

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom,
        zoomControl: false, // We'll add custom positioned zoom control
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      const routeGroup = L.layerGroup().addTo(map);

      markersLayerRef.current = markersGroup;
      routeLayerRef.current = routeGroup;
      mapInstanceRef.current = map;

      // Handle map clicks if editable
      if (editable && onLocationSelect) {
        map.on('click', (e: any) => {
          onLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
      }

      renderMarkers(L, map, markersGroup, routeGroup, filteredGarages);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers and route when props or filters change
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletLibRef.current) return;
    renderMarkers(
      leafletLibRef.current,
      mapInstanceRef.current,
      markersLayerRef.current,
      routeLayerRef.current,
      filteredGarages
    );
  }, [
    customerLocation,
    mechanicLocation,
    garageLocation,
    filteredGarages,
    routeEtaMinutes,
    routeDistanceKm,
  ]);

  const renderMarkers = (
    L: any,
    map: any,
    markersGroup: any,
    routeGroup: any,
    garagesList: MapGaragePin[]
  ) => {
    if (!markersGroup || !routeGroup) return;

    markersGroup.clearLayers();
    routeGroup.clearLayers();

    const bounds: [number, number][] = [];

    // 1. Customer Marker (Pulsing Red SOS Target)
    if (customerLocation) {
      const customerIcon = L.divIcon({
        className: 'custom-customer-sos-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-8 h-8 rounded-full bg-red-500/40 animate-ping"></span>
            <div class="relative w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg border-2 border-white font-black text-[10px]">
              SOS
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const customerMarker = L.marker([customerLocation.lat, customerLocation.lng], {
        icon: customerIcon,
      }).addTo(markersGroup);

      customerMarker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; font-size: 12px; color: #0F172A; min-width: 170px; padding: 4px;">
          <div style="font-weight: 800; color: #DC2626; display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
            🚨 Incident / Customer Location
          </div>
          <div style="color: #64748B; font-size: 11px;">
            Coordinates: <strong>${customerLocation.lat.toFixed(5)}, ${customerLocation.lng.toFixed(5)}</strong>
          </div>
        </div>
      `);

      bounds.push([customerLocation.lat, customerLocation.lng]);
    }

    // 2. Primary / Assigned Garage Marker
    if (garageLocation) {
      const gIcon = L.divIcon({
        className: 'custom-primary-garage-marker',
        html: `
          <div class="w-8 h-8 rounded-xl bg-navy-950 text-white flex items-center justify-center shadow-lg border-2 border-emerald-400 font-bold text-xs">
            🏢
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const gMarker = L.marker([garageLocation.lat, garageLocation.lng], {
        icon: gIcon,
      }).addTo(markersGroup);

      gMarker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; font-size: 12px; color: #0F172A; padding: 4px;">
          <div style="font-weight: 800; color: #0F172A; margin-bottom: 2px;">Assigned Workshop</div>
          <div style="color: #64748B; font-size: 11px;">RepairHub Certified Service Center</div>
        </div>
      `);

      bounds.push([garageLocation.lat, garageLocation.lng]);
    }

    // 3. Mechanic Marker (Blue Wrench / Technician in transit)
    if (mechanicLocation) {
      const mechanicIcon = L.divIcon({
        className: 'custom-mechanic-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-10 h-10 rounded-full bg-blue-500/30 animate-pulse"></span>
            <div class="relative w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xl border-2 border-white text-xs font-bold">
              🔧
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const mechanicMarker = L.marker([mechanicLocation.lat, mechanicLocation.lng], {
        icon: mechanicIcon,
      }).addTo(markersGroup);

      const etaBadge = routeEtaMinutes ? `<div style="margin-top: 4px; background: #FFF7ED; color: #C2410C; border: 1px solid #FFEDD5; border-radius: 6px; padding: 3px 6px; font-weight: 700; font-size: 11px;">ETA: ~${routeEtaMinutes} mins (${routeDistanceKm || 0} km)</div>` : '';

      mechanicMarker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; font-size: 12px; color: #0F172A; min-width: 170px; padding: 4px;">
          <div style="font-weight: 800; color: #2563EB; display: flex; align-items: center; gap: 4px;">
            👨‍🔧 Certified Technician
          </div>
          <div style="color: #64748B; font-size: 11px; margin-top: 2px;">
            Live GPS Satellite Broadcast
          </div>
          ${etaBadge}
        </div>
      `);

      bounds.push([mechanicLocation.lat, mechanicLocation.lng]);
    }

    // 4. Nearby Garages
    if (garagesList && garagesList.length > 0) {
      garagesList.forEach((garage) => {
        const garageIcon = L.divIcon({
          className: 'custom-garage-marker',
          html: `
            <div class="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md border-2 border-white text-[11px] transition-transform hover:scale-110">
              🏪
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const garageMarker = L.marker([garage.lat, garage.lng], {
          icon: garageIcon,
        }).addTo(markersGroup);

        const ratingStr = garage.rating ? `<span style="color: #D97706; font-weight: bold;">⭐ ${garage.rating.toFixed(1)}</span>` : '';
        const phoneStr = garage.phone ? `<div style="margin-top: 2px;"><a href="tel:${garage.phone}" style="color: #2563EB; font-weight: 600; text-decoration: none;">📞 ${garage.phone}</a></div>` : '';
        const distStr = garage.distanceKm ? `<span style="background: #F1F5F9; color: #475569; padding: 1px 5px; border-radius: 4px; font-size: 10px; font-weight: 600;">${garage.distanceKm} km away</span>` : '';
        const emergencyBadge = garage.acceptsEmergency !== false ? `<span style="background: #FEF2F2; color: #DC2626; border: 1px solid #FEE2E2; padding: 1px 5px; border-radius: 4px; font-size: 10px; font-weight: 700;">🚨 SOS Ready</span>` : '';

        garageMarker.bindPopup(`
          <div style="font-family: system-ui, sans-serif; font-size: 12px; color: #0F172A; min-width: 190px; padding: 4px;">
            <div style="font-weight: 800; color: #059669; font-size: 13px; margin-bottom: 2px;">
              ${garage.name}
            </div>
            ${garage.address ? `<div style="color: #64748B; font-size: 11px; margin-bottom: 4px;">📍 ${garage.address}</div>` : ''}
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 4px;">
              ${ratingStr}
              ${distStr}
            </div>
            ${phoneStr}
            <div style="margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap;">
              ${emergencyBadge}
              ${garage.operatingHours ? `<span style="background: #F8FAFC; color: #64748B; padding: 1px 5px; border-radius: 4px; font-size: 10px;">🕒 ${garage.operatingHours}</span>` : ''}
            </div>
          </div>
        `);

        // Only expand bounds for nearby garages if no active route tracking
        if (!mechanicLocation && !customerLocation) {
          bounds.push([garage.lat, garage.lng]);
        }
      });
    }

    // 5. Draw route polyline between mechanic and target
    const targetCoord = customerLocation || garageLocation;
    if (targetCoord && mechanicLocation) {
      const latlngs = [
        [mechanicLocation.lat, mechanicLocation.lng],
        [targetCoord.lat, targetCoord.lng],
      ];

      L.polyline(latlngs, {
        color: '#EA580C', // Brand orange
        weight: 4,
        opacity: 0.9,
        dashArray: '8, 8',
      }).addTo(routeGroup);
    }

    // Auto-fit bounds if we have points
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], zoom);
    }
  };

  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    const center = customerLocation
      ? [customerLocation.lat, customerLocation.lng]
      : mechanicLocation
      ? [mechanicLocation.lat, mechanicLocation.lng]
      : garageLocation
      ? [garageLocation.lat, garageLocation.lng]
      : [26.4499, 80.3319];
    mapInstanceRef.current.setView(center, zoom);
  };

  return (
    <div className="space-y-2">
      {/* Interactive Category Filter Pills */}
      {showFilters && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mr-1">
              <Layers className="w-3.5 h-3.5 text-brand-orange" /> Nearby Garages:
            </span>
            <button
              type="button"
              onClick={() => setActiveFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                activeFilter === 'ALL'
                  ? 'bg-navy-950 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({nearbyGarages.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('CAR')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all flex items-center gap-1 ${
                activeFilter === 'CAR'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🚗 Cars
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('TWO_WHEELER')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all flex items-center gap-1 ${
                activeFilter === 'TWO_WHEELER'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🏍️ 2-Wheelers
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('EMERGENCY')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all flex items-center gap-1 ${
                activeFilter === 'EMERGENCY'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🚨 Roadside SOS
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGarages(!showGarages)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                showGarages
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              {showGarages ? '✓ Garages Visible' : '+ Show Garages'}
            </button>
          </div>
        </div>
      )}

      {/* Main Leaflet Map View */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100 z-0">
        <div ref={mapContainerRef} style={{ height, width: '100%' }} />

        {/* Map Header Overlay Controls */}
        <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleRecenter}
            title="Recenter Map View"
            className="p-2 rounded-xl bg-white/95 hover:bg-white text-navy-900 shadow-md border border-slate-200 transition-all hover:scale-105"
          >
            <Compass className="w-4 h-4 text-brand-orange" />
          </button>
        </div>

        {editable && (
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200 shadow-md text-[11px] font-bold text-navy-900 pointer-events-none z-[1000] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            Click anywhere on map to set breakdown location
          </div>
        )}

        {/* Live Route ETA Footer Pill */}
        {routeEtaMinutes !== undefined && (
          <div className="absolute bottom-3 left-3 bg-navy-950/95 text-white backdrop-blur-md px-3.5 py-2 rounded-xl border border-navy-800 shadow-lg text-xs font-semibold z-[1000] flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Technician Live ETA: <strong className="text-brand-orange font-black">~{routeEtaMinutes} mins</strong> ({routeDistanceKm || 0} km)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
