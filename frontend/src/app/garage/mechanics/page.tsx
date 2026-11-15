'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Phone,
  Wrench,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Shield,
  Star,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { AppLayout } from '../../../components/layout/AppLayout';
import { api } from '../../../lib/api';
import { useToast } from '../../../context/ToastContext';

const SKILL_OPTIONS = [
  'ENGINE',
  'BRAKES',
  'ELECTRICAL',
  'AC',
  'SUSPENSION',
  'GENERAL_SERVICE',
  'BODYWORK',
];

export default function GarageMechanicsPage() {
  const { success, error: toastError } = useToast();

  const [mechanics, setMechanics] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteSkills, setInviteSkills] = useState<string[]>(['ENGINE', 'BRAKES']);
  const [inviteSpec, setInviteSpec] = useState('');
  const [inviteExp, setInviteExp] = useState('3');
  const [inviting, setInviting] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchMechanicsAndInvites = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ mechanics: any[]; invitations: any[] }>('/garage/mechanics');
      setMechanics(res.mechanics || []);
      setInvitations(res.invitations || []);
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch mechanics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMechanicsAndInvites();
  }, []);

  const toggleSkill = (skill: string) => {
    setInviteSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    if (inviteSkills.length === 0) {
      setModalError('Please select at least one repair skill for the mechanic.');
      toastError('Please select at least one repair skill for the mechanic.');
      return;
    }

    setInviting(true);
    try {
      const res = await api.post<{ message: string; invitation: any }>('/garage/mechanics/invite', {
        name: inviteName.trim(),
        email: inviteEmail.trim().toLowerCase(),
        phone: invitePhone.trim(),
        skills: inviteSkills,
        specialization: inviteSpec.trim() || undefined,
        experienceYears: Number(inviteExp) || 0,
      });

      success(res.message);
      setLastInviteUrl(res.invitation.inviteUrl);
      fetchMechanicsAndInvites();
    } catch (err: any) {
      const msg = err.message || 'Failed to dispatch mechanic invitation';
      setModalError(msg);
      toastError(msg);
    } finally {
      setInviting(false);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    success('Invitation URL copied to clipboard!');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const toggleMechanicStatus = async (mechId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.patch(`/garage/mechanics/${mechId}/status`, {
        status: newStatus,
        available: newStatus === 'ACTIVE',
      });
      success(`Mechanic ${newStatus === 'ACTIVE' ? 'activated' : 'suspended'}`);
      fetchMechanicsAndInvites();
    } catch (err: any) {
      toastError(err.message || 'Failed to update mechanic status');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Users className="w-6 h-6 text-brand-cyan" />
              Workshop Mechanics Team
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Invite skilled technicians, manage garage assignments, and track active workloads.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setLastInviteUrl('');
                setInviteModalOpen(true);
              }}
              className="py-2.5 px-4 rounded-xl bg-brand-cyan text-navy-950 font-black text-xs shadow-lg shadow-brand-cyan/20 flex items-center gap-2 hover:bg-cyan-400 transition-colors"
            >
              <UserPlus className="w-4 h-4" /> Invite New Mechanic
            </button>
            <button
              onClick={fetchMechanicsAndInvites}
              className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              title="Refresh Team"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Active Mechanics Section */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-brand-orange" />
              Active Technicians ({mechanics.length})
            </h2>
            <span className="text-xs text-slate-400">
              Assigned specifically to your workshop
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <div className="w-6 h-6 border-2 border-brand-cyan border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading workshop team...
            </div>
          ) : mechanics.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              No mechanics onboarded yet. Click "Invite New Mechanic" above to add your first technician!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-3 px-3">Technician</th>
                    <th className="py-3 px-3">Contact</th>
                    <th className="py-3 px-3">Skills & Specialization</th>
                    <th className="py-3 px-3">Rating</th>
                    <th className="py-3 px-3">Active Jobs</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mechanics.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-slate-900 block">{m.user?.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {m.experienceYears ? `${m.experienceYears} yrs exp` : 'Technician'}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="text-slate-700 block">{m.user?.phone}</span>
                        <span className="text-[10px] text-slate-400">{m.user?.email}</span>
                      </td>

                      <td className="py-3.5 px-3 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {m.skills?.map((sk: string) => (
                            <span
                              key={sk}
                              className="py-0.5 px-1.5 rounded bg-slate-100 text-slate-700 text-[9px] font-bold"
                            >
                              {sk}
                            </span>
                          ))}
                        </div>
                        {m.specialization && (
                          <span className="text-[10px] text-brand-orange font-semibold block mt-0.5">
                            {m.specialization}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          {m.rating} <span className="text-[10px] text-slate-400 font-normal">({m.totalReviews || 0})</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="py-1 px-2.5 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-bold">
                          {m.activeJobCount || 0} active
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span
                          className={`py-1 px-2.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            m.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        <button
                          onClick={() => toggleMechanicStatus(m.id, m.status)}
                          className={`py-1 px-2.5 rounded-lg font-bold text-[11px] transition-colors ${
                            m.status === 'ACTIVE'
                              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          }`}
                        >
                          {m.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending Invitations Section */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Pending Mechanic Invitations ({invitations.length})
            </h2>
            <span className="text-xs text-slate-400">
              Invitations expire in 7 days
            </span>
          </div>

          {invitations.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No pending invitations. All invited technicians have joined!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-3 px-3">Invitee</th>
                    <th className="py-3 px-3">Contact</th>
                    <th className="py-3 px-3">Target Skills</th>
                    <th className="py-3 px-3">Expires At</th>
                    <th className="py-3 px-3 text-right">Invitation Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900">{inv.name}</td>
                      <td className="py-3 px-3">
                        <span className="block text-slate-700">{inv.email}</span>
                        <span className="text-[10px] text-slate-400">{inv.phone}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] text-slate-600 font-semibold">
                          {inv.skills?.join(', ') || 'All categories'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {new Date(inv.expiresAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() =>
                            copyToClipboard(
                              `${window.location.origin}/mechanic/accept-invitation?token=${inv.tokenHash}`
                            )
                          }
                          className="py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 ml-auto"
                        >
                          <Copy className="w-3 h-3" /> Copy Link
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

      {/* Invite Mechanic Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-navy-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-white shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-navy-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand-cyan" />
                <h3 className="text-base font-bold text-white">Invite Technician to Garage</h3>
              </div>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {lastInviteUrl ? (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-2">
                  <p className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Invitation dispatched via email!
                  </p>
                  <p className="text-[11px] text-slate-300">
                    An email was sent to <strong>{inviteEmail}</strong>. You can also copy the activation link below to send directly on WhatsApp:
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-navy-950 border border-navy-700 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-brand-cyan truncate">
                    {lastInviteUrl}
                  </span>
                  <button
                    onClick={() => copyToClipboard(lastInviteUrl)}
                    className="py-1.5 px-3 rounded-lg bg-brand-cyan text-navy-950 text-xs font-bold shrink-0 flex items-center gap-1"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedUrl ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setInviteModalOpen(false);
                    setLastInviteUrl('');
                  }}
                  className="w-full py-2.5 rounded-xl bg-navy-800 hover:bg-navy-750 text-white text-xs font-bold"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                {modalError && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{modalError}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/50"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="ramesh.mech@gmail.com"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/50"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Mobile Phone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={invitePhone}
                      onChange={(e) => setInvitePhone(e.target.value)}
                      placeholder="9876543210"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/50"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="40"
                      value={inviteExp}
                      onChange={(e) => setInviteExp(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/50"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Specialization
                    </label>
                    <input
                      type="text"
                      value={inviteSpec}
                      onChange={(e) => setInviteSpec(e.target.value)}
                      placeholder="e.g. Engine & Transmission Overhauls"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-2">
                    Repair Skills (Select all that apply)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {SKILL_OPTIONS.map((sk) => {
                      const isChecked = inviteSkills.includes(sk);
                      return (
                        <button
                          key={sk}
                          type="button"
                          onClick={() => toggleSkill(sk)}
                          className={`py-1 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                            isChecked
                              ? 'bg-brand-cyan text-navy-950 font-bold'
                              : 'bg-navy-950 text-slate-400 border border-navy-800'
                          }`}
                        >
                          {sk}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-navy-800">
                  <button
                    type="button"
                    onClick={() => setInviteModalOpen(false)}
                    className="py-2 px-3 rounded-xl bg-navy-800 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="py-2 px-4 rounded-xl bg-brand-cyan hover:bg-cyan-400 text-navy-950 text-xs font-black disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {inviting ? 'Generating Invitation...' : 'Send Invitation Email'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}

