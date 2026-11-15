'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Wrench, Mail, ArrowRight, ArrowLeft, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSubmitting(true);

    try {
      await api.post<{ message: string }>('/auth/forgot-password', {
        email: email.trim(),
      });
      setSubmitted(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to request password reset. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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
          Forgot Your <span className="text-brand-orange">Password?</span>
        </h1>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Enter your registered email address below. We'll send you a secure link to reset your password.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-navy-900 border border-navy-800 py-8 px-6 sm:px-10 shadow-2xl rounded-3xl space-y-6">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {submitted ? (
            <div className="space-y-5 text-center py-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-bold text-white">Reset Link Dispatched</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  If an account exists with <strong className="text-white">{email}</strong>, a password-reset link has been sent.
                </p>
                <p className="text-[11px] text-slate-400">
                  Please check your inbox (and spam folder). The link is active for <strong>30 minutes</strong>.
                </p>
              </div>

              <div className="pt-3 border-t border-navy-800 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setEmail('');
                  }}
                  className="text-xs font-semibold text-brand-cyan hover:underline transition-colors"
                >
                  Send to a different email
                </button>

                <Link
                  href="/login"
                  className="w-full py-2.5 px-4 rounded-xl bg-navy-950 hover:bg-navy-800 text-white text-xs font-bold border border-navy-700 flex items-center justify-center gap-2 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-navy-950 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 transition-all"
                  />
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
                    Sending Reset Link...
                  </span>
                ) : (
                  <>
                    Send Reset Link <ArrowRight className="w-4 h-4" />
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
      </div>
    </div>
  );
}

