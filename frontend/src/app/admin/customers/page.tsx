'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Car,
  Bike,
  Truck,
  Wrench,
  Mail,
  Phone,
  Calendar,
  X,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { AppLayout } from '../../../components/layout/AppLayout';
import { CardSkeleton } from '../../../components/common/LoadingSkeleton';
import { api } from '../../../lib/api';
import { formatDate } from '../../../lib/utils';
import { useToast } from '../../../context/ToastContext';

interface CustomerVehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  regNo: string;
  type: 'CAR' | 'TWO_WHEELER' | 'COMMERCIAL';
}

interface CustomerAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  vehicles: CustomerVehicle[];
  _count: {
    customerRequests: number;
  };
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerAccount | null>(null);

  const { error } = useToast();

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      const res = await api.get<{ customers: CustomerAccount[] }>(`/admin/customers${query}`);
      setCustomers(res.customers || []);
    } catch (err: any) {
      error(err?.message || 'Failed to load customer accounts');
    } finally {
      setLoading(false);
    }
  }, [search, error]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const totalVehiclesCount = customers.reduce(
    (acc, curr) => acc + (curr.vehicles?.length || 0),
    0
  );

  const totalBookingsCount = customers.reduce(
    (acc, curr) => acc + (curr._count?.customerRequests || 0),
    0
  );

  const getVehicleIcon = (type?: string) => {
    switch (type) {
      case 'TWO_WHEELER':
        return <Bike className="w-3.5 h-3.5 text-amber-600" />;
      case 'COMMERCIAL':
        return <Truck className="w-3.5 h-3.5 text-purple-600" />;
      case 'CAR':
      default:
        return <Car className="w-3.5 h-3.5 text-blue-600" />;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-navy-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-cyan/20 text-brand-cyan text-xs font-bold border border-brand-cyan/30">
              <UserCheck className="w-3.5 h-3.5" /> Customer Accounts &amp; Fleet Directory
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Customer Accounts ({customers.length})
            </h1>
            <p className="text-xs text-slate-300">
              Platform-wide customer registry with vehicle ownership data, repair history, and direct account oversight.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchCustomers}
              className="p-3 rounded-2xl bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white transition-colors border border-navy-700 flex items-center gap-2 text-xs font-bold"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <Link
              href="/admin/vehicles"
              className="px-5 py-3 rounded-2xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold shadow-lg shadow-brand-orange/30 flex items-center gap-2 transition-all"
            >
              <Car className="w-4 h-4" /> View All Vehicles
            </Link>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-50 text-brand-cyan flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-black text-navy-900">{customers.length}</span>
              <p className="text-xs text-slate-500 font-semibold">Registered Customers</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-50 text-brand-orange flex items-center justify-center">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-black text-navy-900">{totalVehiclesCount}</span>
              <p className="text-xs text-slate-500 font-semibold">Customer Vehicles in Fleet</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-black text-navy-900">{totalBookingsCount}</span>
              <p className="text-xs text-slate-500 font-semibold">Total Repair Requests</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer by name, email address, or phone number..."
            className="w-full text-xs font-semibold focus:outline-none placeholder:text-slate-400 text-navy-900"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 py-1"
            >
              Clear
            </button>
          )}
        </div>

        {/* Customers Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-4">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : customers.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Users className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-navy-900">No Customers Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {search
                  ? `No customer accounts matching "${search}".`
                  : 'No customer accounts have registered on the platform yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Customer Account</th>
                    <th className="py-3.5 px-4">Contact Details</th>
                    <th className="py-3.5 px-4">Registered Vehicles</th>
                    <th className="py-3.5 px-4 text-center">Total Requests</th>
                    <th className="py-3.5 px-4">Joined Date</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomer(c)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                    >
                      {/* Customer Profile */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-navy-900 text-white flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-brand-orange transition-colors">
                            {c.name ? c.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <p className="font-extrabold text-navy-900 text-xs group-hover:text-brand-orange transition-colors">
                              {c.name || 'Unnamed Customer'}
                            </p>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: {c.id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contact Details */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-navy-900 font-medium">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[200px]">{c.email}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{c.phone || 'No phone'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Registered Vehicles */}
                      <td className="py-4 px-4">
                        {c.vehicles && c.vehicles.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {c.vehicles.map((v) => (
                              <span
                                key={v.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-navy-900 text-[11px] font-semibold border border-slate-200"
                              >
                                {getVehicleIcon(v.type)}
                                <span className="font-bold">{v.make}</span> {v.model}
                                <span className="text-[10px] text-slate-500 font-mono">
                                  ({v.regNo})
                                </span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">
                            No vehicles added
                          </span>
                        )}
                      </td>

                      {/* Total Requests */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-navy-900 font-bold text-xs border border-slate-200">
                          <Wrench className="w-3 h-3 text-brand-orange" />
                          {c._count?.customerRequests || 0}
                        </span>
                      </td>

                      {/* Joined Date */}
                      <td className="py-4 px-4 text-slate-600 font-medium whitespace-nowrap">
                        {formatDate(c.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomer(c);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-navy-50 hover:bg-brand-orange hover:text-white text-navy-700 text-xs font-bold transition-all inline-flex items-center gap-1"
                        >
                          View Profile <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Customer Detail Drawer Modal */}
        {selectedCustomer && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden animate-slide-up sm:animate-none">
              {/* Drawer Header */}
              <div className="p-6 bg-navy-950 text-white flex items-center justify-between border-b border-navy-800">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-brand-orange flex items-center justify-center font-bold text-lg text-white">
                    {selectedCustomer.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {selectedCustomer.name || 'Customer Account'}
                    </h2>
                    <p className="text-xs text-slate-300 font-mono">
                      ID: {selectedCustomer.id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-navy-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Account Summary Metrics */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Vehicles Registered</span>
                    <p className="text-xl font-black text-navy-900 mt-0.5">
                      {selectedCustomer.vehicles?.length || 0}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Total Repair Bookings</span>
                    <p className="text-xl font-black text-brand-orange mt-0.5">
                      {selectedCustomer._count?.customerRequests || 0}
                    </p>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-brand-orange" />
                    Customer Details
                  </h3>
                  <div className="space-y-2.5 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Full Name:</span>
                      <strong className="text-navy-900 font-semibold">{selectedCustomer.name}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Email Address:</span>
                      <strong className="text-navy-900 font-mono">{selectedCustomer.email}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Phone Number:</span>
                      <strong className="text-navy-900 font-mono">{selectedCustomer.phone || 'N/A'}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Account Onboarded:</span>
                      <span className="text-slate-700">{formatDate(selectedCustomer.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Registered Vehicles List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
                      <Car className="w-4 h-4 text-brand-cyan" />
                      Registered Vehicles ({selectedCustomer.vehicles?.length || 0})
                    </h3>
                    {selectedCustomer.name && (
                      <Link
                        href={`/admin/vehicles?search=${encodeURIComponent(selectedCustomer.name)}`}
                        className="text-[11px] font-bold text-brand-orange hover:underline inline-flex items-center gap-1"
                      >
                        Inspect in Vehicle Fleet <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>

                  {selectedCustomer.vehicles && selectedCustomer.vehicles.length > 0 ? (
                    <div className="space-y-2.5">
                      {selectedCustomer.vehicles.map((v) => (
                        <div
                          key={v.id}
                          className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-slate-300 transition-all flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-bold">
                              {getVehicleIcon(v.type)}
                            </div>
                            <div>
                              <h4 className="font-extrabold text-navy-900 text-xs">
                                {v.year} {v.make} {v.model}
                              </h4>
                              <p className="text-[11px] font-mono font-bold text-brand-orange">
                                {v.regNo}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                            {v.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 text-center text-xs text-slate-400 italic">
                      This customer has not registered any vehicles yet.
                    </div>
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
