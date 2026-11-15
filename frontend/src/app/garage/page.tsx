'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Calendar,
  Clock,
  Wrench,
  CheckCircle2,
  IndianRupee,
  Users,
  AlertCircle,
  ArrowRight,
  UserPlus,
  RefreshCw,
  MapPin,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function GarageDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [mechanicsList, setMechanicsList] = useState<any[]>([]);
  const [selectedMechanicId, setSelectedMechanicId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get<any>('/garage/dashboard');
      setData(res);
    } catch (err: any) {
      if (err.status === 'PENDING' || err.status === 'REJECTED' || err.status === 'SUSPENDED') {
        router.push('/garage/status');
        return;
      }
      toastError(err.message || 'Failed to load garage dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchMechanicsForModal = async () => {
    try {
      const res = await api.get<{ mechanics: any[] }>('/garage/mechanics');
      setMechanicsList(res.mechanics.filter((m) => m.status === 'ACTIVE'));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchMechanicsForModal();
  }, []);

  const openAssignModal = (req: any) => {
    setSelectedRequest(req);
    setSelectedMechanicId(req.mechanic?.id || '');
    setAssignModalOpen(true);
  };

  const handleAssignMechanic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMechanicId) {
      toastError('Please select a mechanic');
      return;
    }

    setAssigning(true);
    try {
      await api.post(`/garage/bookings/${selectedRequest.id}/assign`, {
        mechanicId: selectedMechanicId,
      });
      success('Mechanic assigned successfully!');
      setAssignModalOpen(false);
      fetchDashboard();
    } catch (err: any) {
      toastError(err.message || 'Failed to assign mechanic');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="py-24 text-center text-slate-400 text-xs">
          <div className="w-8 h-8 border-4 border-brand-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          Loading your garage dashboard...
        </div>
      </AppLayout>
    );
  }

  const garage = data?.garage || user?.ownedGarage;
  const metrics = data?.metrics || {};
  const recentBookings = data?.recentBookings || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Workshop Banner Header */}
        <div className="bg-navy-900 border border-navy-800 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl">
          <div className="absolute right-0 top-0 w-80 h-80 bg-brand-cyan/10 blur-[100px] pointer-events-none rounded-full" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="py-1 px-2.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Approved & Verified Garage
                </span>
                <span className="text-[11px] text-slate-400">
                  ID: {garage?.id?.slice(0, 8)}...
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                <Building2 className="w-7 h-7 text-brand-cyan" />
                {garage?.name}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-brand-orange" />
                  {garage?.address}, {garage?.city}
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {garage?.phone}
                </span>
                {garage?.operatingHours && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {garage.operatingHours}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/garage/mechanics"
                className="py-2.5 px-4 rounded-xl bg-brand-cyan text-navy-950 font-black text-xs shadow-lg shadow-brand-cyan/20 flex items-center gap-2 hover:bg-cyan-400 transition-colors"
              >
                <UserPlus className="w-4 h-4" /> Invite Mechanic
              </Link>
              <button
                onClick={fetchDashboard}
                className="p-2.5 rounded-xl bg-navy-800 text-slate-300 hover:text-white hover:bg-navy-750 transition-colors"
                title="Refresh Metrics"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 6 Metric KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Total Bookings</span>
            <p className="text-2xl font-black text-slate-900">{metrics.totalBookings || 0}</p>
            <span className="text-[10px] text-slate-400 block">All time requests</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-1">
            <span className="text-[11px] font-bold text-amber-600 uppercase">Pending Action</span>
            <p className="text-2xl font-black text-amber-600">{metrics.pendingRequests || 0}</p>
            <span className="text-[10px] text-slate-400 block">Awaiting assignment</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-1">
            <span className="text-[11px] font-bold text-blue-600 uppercase">In Progress</span>
            <p className="text-2xl font-black text-blue-600">{metrics.inProgressRequests || 0}</p>
            <span className="text-[10px] text-slate-400 block">Active workshop bay</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-1">
            <span className="text-[11px] font-bold text-emerald-600 uppercase">Completed</span>
            <p className="text-2xl font-black text-emerald-600">{metrics.completedRequests || 0}</p>
            <span className="text-[10px] text-slate-400 block">Repairs finished</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-1">
            <span className="text-[11px] font-bold text-purple-600 uppercase">Active Mechanics</span>
            <p className="text-2xl font-black text-purple-600">
              {metrics.activeMechanicsCount || 0}
              <span className="text-xs font-normal text-slate-400 ml-1">/ {metrics.totalMechanicsCount || 0}</span>
            </p>
            <span className="text-[10px] text-slate-400 block">On-duty technicians</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-1">
            <span className="text-[11px] font-bold text-emerald-600 uppercase">Total Revenue</span>
            <p className="text-xl sm:text-2xl font-black text-slate-900 flex items-center">
              ₹{(metrics.totalRevenueRupees || 0).toLocaleString('en-IN')}
            </p>
            <span className="text-[10px] text-slate-400 block">Settled via Razorpay/Cash</span>
          </div>
        </div>

        {/* Recent Service Requests Section */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-brand-orange" />
              <h2 className="text-base font-bold text-slate-900">Recent Service Bookings</h2>
            </div>
            <Link
              href="/garage/bookings"
              className="text-xs font-bold text-brand-orange hover:underline flex items-center gap-1"
            >
              View All ({metrics.totalBookings || 0}) <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentBookings.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              No service bookings received yet. Your approved garage is ready to receive requests!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-3 px-3">Request #</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Vehicle</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Mechanic</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentBookings.map((b: any) => (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {b.requestNumber}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 block">{b.customer?.name}</span>
                        <span className="text-[10px] text-slate-400">{b.customer?.phone}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-800 block">
                          {b.vehicle?.make} {b.vehicle?.model}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400 uppercase">
                          {b.vehicle?.regNo}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="py-1 px-2 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                          {b.category}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="py-1 px-2.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20">
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {b.mechanic ? (
                          <span className="font-semibold text-slate-700">{b.mechanic.name}</span>
                        ) : (
                          <span className="text-amber-500 font-bold text-[10px]">Not Assigned</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => openAssignModal(b)}
                          className="py-1.5 px-3 rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-bold text-[11px] transition-colors"
                        >
                          {b.mechanic ? 'Reassign' : 'Assign Mechanic'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Mechanic Assignment Modal */}
      {assignModalOpen && selectedRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-navy-800 rounded-3xl p-6 max-w-md w-full text-white shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-navy-800 pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-brand-orange" />
                <h3 className="text-sm font-bold text-white">Assign Mechanic to Job</h3>
              </div>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-navy-950 border border-navy-800 text-xs space-y-1">
              <p className="text-slate-400">
                Job Card: <span className="font-bold text-white">{selectedRequest.requestNumber}</span>
              </p>
              <p className="text-slate-400">
                Vehicle: <span className="font-bold text-white">{selectedRequest.vehicle?.make} {selectedRequest.vehicle?.model} ({selectedRequest.vehicle?.regNo})</span>
              </p>
              <p className="text-slate-400">
                Category: <span className="font-bold text-brand-cyan">{selectedRequest.category}</span>
              </p>
            </div>

            <form onSubmit={handleAssignMechanic} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Select Active Mechanic
                </label>
                {mechanicsList.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                    No active mechanics found in your garage.{' '}
                    <Link href="/garage/mechanics" className="underline font-bold">
                      Invite a mechanic first
                    </Link>
                  </div>
                ) : (
                  <select
                    required
                    value={selectedMechanicId}
                    onChange={(e) => setSelectedMechanicId(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                  >
                    <option value="">-- Choose Workshop Mechanic --</option>
                    {mechanicsList.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name} ({m.skills?.join(', ') || 'General'}) — ★ {m.rating} ({m.activeJobCount || 0} active jobs)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="py-2 px-3 rounded-xl bg-navy-800 hover:bg-navy-750 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || mechanicsList.length === 0}
                  className="py-2 px-4 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {assigning ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

