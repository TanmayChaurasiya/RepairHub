'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Wrench,
  Building2,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  User,
  Mail,
  Award,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';

function AcceptInvitationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const { setAuthData } = useAuth();
  const { success } = useToast();

  const [invitation, setInvitation] = useState<any>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteError, setInviteError] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [experienceYears, setExperienceYears] = useState('3');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!token) {
      setInviteError('No invitation token found in link. Please verify your email.');
      setLoadingInvite(false);
      return;
    }

    api
      .get<{ invitation: any }>(`/mechanics/invitation/${token}`)
      .then((res) => {
        setInvitation(res.invitation);
      })
      .catch((err: any) => {
        setInviteError(err.message || 'This invitation is invalid or has expired.');
      })
      .finally(() => {
        setLoadingInvite(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await api.post<{
        message: string;
        user: any;
        accessToken: string;
        refreshToken: string;
      }>('/mechanics/accept-invitation', {
        token,
        password,
        specialization: specialization.trim() || undefined,
        experienceYears: Number(experienceYears) || 0,
      });

      setAuthData(res.user, res.accessToken, res.refreshToken);
      success('Account activated! Welcome to the RepairHub mechanic team.');
      router.push('/mechanic');
    } catch (err: any) {
      setFormError(err.message || 'Failed to activate mechanic account.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInvite) {
    return (
      <div className="py-12 text-center text-slate-400 text-xs">
        <div className="w-5 h-5 border-2 border-brand-orange border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Validating invitation link...
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="bg-navy-900 border border-navy-800 p-8 rounded-3xl text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white">Invalid or Expired Invitation</h2>
          <p className="text-xs text-slate-400">{inviteError}</p>
        </div>
        <Link
          href="/login"
          className="inline-block py-2.5 px-4 rounded-xl bg-navy-800 hover:bg-navy-750 text-white text-xs font-bold transition-colors"
        >
          Return to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-navy-900 border border-navy-800 p-6 sm:p-10 shadow-2xl rounded-3xl space-y-6">
      {/* Garage badge */}
      <div className="p-4 rounded-2xl bg-navy-950 border border-brand-cyan/30 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-cyan/20 text-brand-cyan flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <span className="text-[10px] font-bold text-brand-cyan uppercase tracking-wider block">
            Invited by Workshop
          </span>
          <h3 className="text-sm font-bold text-white truncate">
            {invitation?.garage?.name}
          </h3>
          <p className="text-[11px] text-slate-400 truncate">
            {invitation?.garage?.city}
          </p>
        </div>
      </div>

      {formError && (
        <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Pre-filled read-only fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-navy-950/70 border border-navy-800">
            <span className="text-[10px] text-slate-500 block">Mechanic Name</span>
            <span className="font-bold text-slate-200 flex items-center gap-1.5 mt-0.5">
              <User className="w-3.5 h-3.5 text-slate-400" /> {invitation?.name}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-navy-950/70 border border-navy-800">
            <span className="text-[10px] text-slate-500 block">Registered Email</span>
            <span className="font-bold text-slate-200 flex items-center gap-1.5 mt-0.5 truncate">
              <Mail className="w-3.5 h-3.5 text-slate-400" /> {invitation?.email}
            </span>
          </div>
        </div>

        {/* Assigned Skills */}
        {invitation?.skills && invitation.skills.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Assigned Repair Skills
            </label>
            <div className="flex flex-wrap gap-1.5">
              {invitation.skills.map((sk: string) => (
                <span
                  key={sk}
                  className="py-1 px-2.5 rounded-lg bg-navy-950 border border-brand-orange/30 text-brand-orange text-[10px] font-bold"
                >
                  {sk}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Password */}
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1.5">
            Create Password *
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1.5">
            Confirm Password *
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
            />
          </div>
        </div>

        {/* Specialization & Experience */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Specialization (Optional)
            </label>
            <div className="relative">
              <Award className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                placeholder="e.g. Engine Specialist"
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Experience (Years)
            </label>
            <input
              type="number"
              min="0"
              max="40"
              value={experienceYears}
              onChange={(e) => setExperienceYears(e.target.value)}
              className="w-full px-4 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 px-4 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-extrabold shadow-lg shadow-brand-orange/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Activating Account...
            </span>
          ) : (
            <>
              Activate Account & Join Team <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <div className="min-h-screen bg-navy-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 px-4 selection:bg-brand-orange selection:text-white relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-orange/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3 relative z-10">
        <Link href="/" className="inline-flex items-center gap-2.5 group">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-orange to-amber-500 flex items-center justify-center text-white shadow-xl shadow-brand-orange/30 group-hover:scale-105 transition-transform">
            <Wrench className="w-6 h-6" />
          </div>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Join Your <span className="text-brand-orange">Garage Team</span>
        </h1>
        <p className="text-xs text-slate-400">
          Set up your mechanic password to start receiving repair and service assignments
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Suspense
          fallback={
            <div className="bg-navy-900 border border-navy-800 py-8 px-6 sm:px-10 shadow-2xl rounded-3xl text-center text-slate-400 text-xs">
              Loading invitation details...
            </div>
          }
        >
          <AcceptInvitationForm />
        </Suspense>
      </div>
    </div>
  );
}

