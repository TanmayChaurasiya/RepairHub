'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Wrench, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success } = useToast();

  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    const qToken = searchParams.get('token');
    if (qToken) {
      setToken(qToken.trim());
    } else {
      setErrorMessage('Missing password reset token. Please use the link provided in your email.');
    }
  }, [searchParams]);

  // Client-side password validation
  const validateInput = (): string | null => {
    if (!token) {
      return 'Missing or invalid password reset token. Please request a new link.';
    }
    if (password.length < 8) {
      return 'Password must be at least 8 characters long.';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter (A-Z).';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one numeric digit (0-9).';
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match. Please verify both fields.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const validationError = validateInput();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setSubmitting(true);

    try {
      const res = await api.post<{ message: string }>('/auth/reset-password', {
        token,
        password,
      });

      setResetSuccess(true);
      success(res.message || 'Password reset successful! Please log in.');

      // Redirect to login after a brief visual confirmation
      setTimeout(() => {
        router.push('/login');
      }, 2500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reset password. The link may be expired or invalid.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-navy-900 border border-navy-800 py-8 px-6 sm:px-10 shadow-2xl rounded-3xl space-y-6">
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {resetSuccess ? (
        <div className="space-y-5 text-center py-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-bold text-white">Password Changed Successfully!</h3>
            <p className="text-xs text-slate-300">
              Your password has been updated. All previous sessions have been logged out for your security.
            </p>
            <p className="text-[11px] text-slate-400">
              Redirecting you to the sign-in page...
            </p>
          </div>

          <div className="pt-3 border-t border-navy-800">
            <Link
              href="/login"
              className="w-full py-2.5 px-4 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-brand-orange/25"
            >
              Sign In Now <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : !token ? (
        <div className="space-y-4 text-center py-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">Invalid Reset Link</h3>
            <p className="text-xs text-slate-400">
              No reset token was found in the URL. Please click the full link in your email or request a new reset.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/forgot-password"
              className="py-2.5 px-4 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold flex items-center justify-center gap-2 transition-all"
            >
              Request New Reset Link
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Password */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              New Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 chars, 1 uppercase, 1 number"
                className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-200 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Minimum 8 characters with at least one uppercase letter and one number.
            </p>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-200 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-extrabold shadow-lg shadow-brand-orange/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Resetting Password...
              </span>
            ) : (
              <>
                Reset Password <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="text-center pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-navy-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 px-4 selection:bg-brand-orange selection:text-white relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-cyan/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3 relative z-10">
        <Link href="/" className="inline-flex items-center gap-2.5 group">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-orange to-amber-500 flex items-center justify-center text-white shadow-xl shadow-brand-orange/30 group-hover:scale-105 transition-transform">
            <Wrench className="w-6 h-6" />
          </div>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Create New <span className="text-brand-orange">Password</span>
        </h1>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Please enter and confirm your new secure password.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Suspense
          fallback={
            <div className="bg-navy-900 border border-navy-800 p-8 rounded-3xl text-center text-slate-400 text-xs">
              Loading password reset...
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}

