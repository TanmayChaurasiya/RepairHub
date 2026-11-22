'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Car,
  Bike,
  Truck,
  Search,
  Filter,
  Calendar,
  User,
  Mail,
  Phone,
  Wrench,
  X,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ShieldCheck,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { AppLayout } from '../../../components/layout/AppLayout';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { CardSkeleton } from '../../../components/common/LoadingSkeleton';
import { api } from '../../../lib/api';
import { formatDate, formatINR } from '../../../lib/utils';
import { useToast } from '../../../context/ToastContext';

interface CustomerVehicle {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerVehicleCount: number;
  vehicleName: string;
  category: 'TWO_WHEELER' | 'CAR' | 'COMMERCIAL';
  brand: string;
  model: string;
  year: number;
  registrationNumber: string;
  registrationDate: string;
  totalRequests: number;
  latestRequest: {
    id: string;
    requestNumber: string;
    status: string;
    category: string;
    createdAt: string;
  } | null;
}

export default function AdminCustomerVehiclesPage() {
  const [vehicles, setVehicles] = useState<CustomerVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVehicles, setTotalVehicles] = useState(0);

  // Vehicle Detail Drawer State
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const { error } = useToast();

  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '15',
      });

      if (search.trim()) queryParams.set('search', search.trim());
      if (categoryFilter !== 'ALL') queryParams.set('category', categoryFilter);

      const res = await api.get<{
        vehicles: CustomerVehicle[];
        pagination: { total: number; totalPages: number };
      }>(`/admin/vehicles?${queryParams.toString()}`);

      setVehicles(res.vehicles);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalVehicles(res.pagination.total || 0);
    } catch (err: any) {
      error(err?.message || 'Failed to load customer vehicles');
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter, error]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const handleOpenDrawer = async (vehicleId: string) => {
    try {
      setDrawerLoading(true);
      const res = await api.get<{ vehicle: any }>(`/admin/vehicles/${vehicleId}`);
      setSelectedVehicle(res.vehicle);
    } catch (err: any) {
      error(err?.message || 'Failed to load vehicle details');
    } finally {
      setDrawerLoading(false);
    }
  };

  const getVehicleIcon = (cat?: string) => {
    switch (cat) {
      case 'TWO_WHEELER':
        return <Bike className="w-5 h-5 text-amber-600" />;
      case 'COMMERCIAL':
        return <Truck className="w-5 h-5 text-purple-600" />;
      case 'CAR':
      default:
        return <Car className="w-5 h-5 text-blue-600" />;
    }
  };

  const getCategoryBadge = (cat?: string) => {
    switch (cat) {
      case 'TWO_WHEELER':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap shrink-0 shadow-sm">
            🛵 Two Wheeler
          </span>
        );
      case 'COMMERCIAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap shrink-0 shadow-sm">
            🚚 Commercial
          </span>
        );
      case 'CAR':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap shrink-0 shadow-sm">
            🚗 Car / Sedan
          </span>
        );
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-navy-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-orange/20 text-brand-orange text-xs font-bold border border-brand-orange/30">
              <Car className="w-3.5 h-3.5" /> Fleet &amp; Customer Asset Directory
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Customer Vehicles ({totalVehicles})
            </h1>
            <p className="text-xs text-slate-300">
              Live supervision of all vehicles registered by customers across Kanpur, with maintenance history, automated email alerts, and multi-vehicle tracking.
            </p>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by customer, email, reg no, brand..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {['ALL', 'CAR', 'TWO_WHEELER', 'COMMERCIAL'].map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setCategoryFilter(cat);
                  setPage(1);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-navy-900 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat === 'ALL' ? 'All Vehicles' : cat === 'TWO_WHEELER' ? 'Two Wheelers' : cat === 'CAR' ? 'Cars' : 'Commercial'}
              </button>
            ))}
          </div>
        </div>

        {/* Vehicles Table Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-4">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : vehicles.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <Car className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-navy-900">No Vehicles Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No customer vehicles matched your active search and category filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3.5 px-4">Vehicle Details</th>
                    <th className="py-3.5 px-4 min-w-[140px] whitespace-nowrap">Category</th>
                    <th className="py-3.5 px-4">Customer Account</th>
                    <th className="py-3.5 px-4">Registration No.</th>
                    <th className="py-3.5 px-4">Registered Date</th>
                    <th className="py-3.5 px-4">Repairs History</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vehicles.map((v) => (
                    <tr
                      key={v.id}
                      onClick={() => handleOpenDrawer(v.id)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 font-bold group-hover:bg-brand-orange/10 transition-colors">
                            {getVehicleIcon(v.category)}
                          </div>
                          <div>
                            <p className="font-bold text-navy-900 text-xs group-hover:text-brand-orange transition-colors">
                              {v.vehicleName}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {v.brand} &bull; {v.model} ({v.year})
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 min-w-[140px] whitespace-nowrap">{getCategoryBadge(v.category)}</td>

                      <td className="py-4 px-4">
                        <div>
                          <p className="font-bold text-navy-900 flex items-center gap-1.5">
                            <User className="w-3 h-3 text-slate-400" />
                            {v.customerName}
                          </p>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            <Mail className="w-3 h-3 text-slate-400" />
                            {v.customerEmail}
                          </p>
                          {v.customerVehicleCount > 1 && (
                            <span className="inline-block mt-0.5 text-[10px] font-bold text-brand-orange">
                              +{v.customerVehicleCount - 1} other vehicle{v.customerVehicleCount > 2 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span className="font-mono font-black text-navy-950 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          {v.registrationNumber}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-slate-600 font-medium">
                        {formatDate(v.registrationDate)}
                      </td>

                      <td className="py-4 px-4">
                        {v.totalRequests > 0 ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 font-bold text-navy-900">
                              <Wrench className="w-3 h-3 text-brand-orange" />
                              {v.totalRequests} repair{v.totalRequests > 1 ? 's' : ''}
                            </span>
                            {v.latestRequest && (
                              <div>
                                <StatusBadge status={v.latestRequest.status} />
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">No repairs yet</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDrawer(v.id);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-navy-50 hover:bg-brand-orange hover:text-white text-navy-700 text-xs font-bold transition-all inline-flex items-center gap-1"
                        >
                          View Details <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Page {page} of {totalPages} ({totalVehicles} registered vehicles)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-navy-900 hover:bg-slate-50 disabled:opacity-50 transition-all flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-navy-900 hover:bg-slate-50 disabled:opacity-50 transition-all flex items-center gap-1"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Vehicle Detail Drawer Modal */}
        {selectedVehicle && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden animate-slide-up sm:animate-none">
              {/* Drawer Header */}
              <div className="p-6 bg-navy-950 text-white flex items-center justify-between border-b border-navy-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-navy-800 flex items-center justify-center text-white">
                    {getVehicleIcon(selectedVehicle.type)}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                    </h2>
                    <p className="text-xs text-slate-300 font-mono">
                      Reg: {selectedVehicle.regNo}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedVehicle(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-navy-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Vehicle Specs Summary */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Category</span>
                    <p className="text-xs font-bold text-navy-900 mt-0.5">{getCategoryBadge(selectedVehicle.type)}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Manufacturer</span>
                    <p className="text-xs font-bold text-navy-900 mt-0.5">{selectedVehicle.make}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Model &amp; Year</span>
                    <p className="text-xs font-bold text-navy-900 mt-0.5">{selectedVehicle.model} ({selectedVehicle.year})</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Onboarded On</span>
                    <p className="text-xs font-bold text-navy-900 mt-0.5">{formatDate(selectedVehicle.createdAt)}</p>
                  </div>
                </div>

                {/* Customer Account Details */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4 text-brand-orange" />
                    Customer Ownership Information
                  </h3>
                  <div className="space-y-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Owner Name:</span>
                      <strong className="text-navy-900 font-semibold">{selectedVehicle.customer?.name}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Email Address:</span>
                      <strong className="text-navy-900 font-mono">{selectedVehicle.customer?.email}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Contact Phone:</span>
                      <strong className="text-navy-900 font-mono">{selectedVehicle.customer?.phone}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Account Created:</span>
                      <span className="text-slate-700">{formatDate(selectedVehicle.customer?.createdAt)}</span>
                    </div>
                  </div>

                  {/* Customer's Other Vehicles */}
                  {selectedVehicle.customer?.vehicles && selectedVehicle.customer.vehicles.length > 1 && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <span className="text-[11px] font-bold text-slate-500 uppercase block mb-2">
                        Other Vehicles Owned by this Customer ({selectedVehicle.customer.vehicles.length - 1}):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {selectedVehicle.customer.vehicles
                          .filter((ov: any) => ov.id !== selectedVehicle.id)
                          .map((ov: any) => (
                            <button
                              key={ov.id}
                              onClick={() => handleOpenDrawer(ov.id)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-navy-900 font-semibold text-[11px] transition-colors border border-slate-200 flex items-center gap-1"
                            >
                              <Car className="w-3 h-3 text-slate-500" />
                              {ov.make} {ov.model} ({ov.regNo})
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Automated Email Notifications Dispatched */}
                {selectedVehicle.emailNotifications && selectedVehicle.emailNotifications.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                    <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
                      <Mail className="w-4 h-4 text-brand-cyan" />
                      Automated Availability Emails Dispatched
                    </h3>
                    <div className="space-y-2">
                      {selectedVehicle.emailNotifications.map((notif: any) => (
                        <div
                          key={notif.id}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-navy-900 truncate max-w-[280px]">
                              {notif.subject}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                notif.status === 'SENT'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : notif.status === 'FAILED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {notif.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>To: {notif.recipient}</span>
                            <span>{formatDate(notif.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Service & Repair History */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-brand-orange" />
                    Service Bookings History ({selectedVehicle.requests?.length || 0})
                  </h3>

                  {selectedVehicle.requests && selectedVehicle.requests.length > 0 ? (
                    <div className="space-y-3">
                      {selectedVehicle.requests.map((req: any) => (
                        <div
                          key={req.id}
                          className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-slate-300 transition-all space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-navy-900 text-xs">
                              {req.requestNumber}
                            </span>
                            <StatusBadge status={req.status} />
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-2">
                            {req.description}
                          </p>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                            <span>Workshop: <strong>{req.garage?.name}</strong></span>
                            <span>Technician: <strong>{req.mechanic?.name || 'Unassigned'}</strong></span>
                          </div>
                          <div className="pt-1 flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">
                              {formatDate(req.createdAt)}
                            </span>
                            <Link
                              href={`/admin/requests/${req.id}`}
                              className="text-xs font-bold text-brand-orange hover:underline inline-flex items-center gap-1"
                            >
                              Inspect Request &rarr;
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl text-center">
                      No service bookings recorded for this vehicle yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
