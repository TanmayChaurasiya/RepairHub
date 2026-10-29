'use client';

import React from 'react';
import Link from 'next/link';
import {
  Wrench,
  ShieldCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck,
  ArrowRight,
  Car,
  Star,
  Users,
  Building2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col selection:bg-brand-orange selection:text-white">
      {/* Navigation Bar */}
      <header className="bg-navy-950/90 backdrop-blur-md border-b border-navy-800/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-orange to-amber-500 flex items-center justify-center text-white shadow-lg shadow-brand-orange/30 group-hover:scale-105 transition-transform">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white block">
                Repair<span className="text-brand-orange">Hub</span>
              </span>
              <span className="text-[10px] font-bold text-brand-cyan uppercase tracking-widest block">
                Kanpur Pilot Garage Network
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <a href="#workflow" className="hover:text-brand-cyan transition-colors">
              Workflow
            </a>
            <a href="#features" className="hover:text-brand-cyan transition-colors">
              Platform Roles
            </a>
            <a href="#demo-logins" className="hover:text-brand-orange transition-colors">
              Demo Credentials
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-200 hover:text-white bg-navy-800/80 hover:bg-navy-700/80 border border-navy-700/60 transition-all"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-brand-orange hover:bg-brand-orange-hover shadow-lg shadow-brand-orange/25 transition-all"
            >
              Book Service
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section (Dark Navy #0B1729) */}
      <section className="bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950 text-white pt-16 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-cyan/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-brand-orange/10 blur-[140px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-navy-800/80 border border-brand-cyan/30 text-brand-cyan text-xs font-bold tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-brand-orange" />
              Pilot Live in Kanpur (Sarvodaya Nagar & GT Road)
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15] text-white">
              Transparent Vehicle Repair for{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange via-amber-400 to-brand-cyan">
                Modern Indian Garages
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-2xl font-normal leading-relaxed mx-auto lg:mx-0">
              Replace verbal estimates, paper job cards, and phone tag with one seamless digital platform.
              Vehicle owners approve transparent line-item estimates before any work starts.
            </p>

            {/* Hero CTA & Trust Badges */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link
                href="/login"
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-sm font-extrabold shadow-xl shadow-brand-orange/30 flex items-center justify-center gap-2 transition-all"
              >
                Launch Live Portal <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#demo-logins"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-navy-800/90 hover:bg-navy-700 text-slate-200 text-sm font-bold border border-navy-700/80 flex items-center justify-center gap-2 transition-all"
              >
                View Seed Logins
              </a>
            </div>

            {/* Metrics Ticker */}
            <div className="pt-8 border-t border-navy-800/60 grid grid-cols-3 gap-6 text-center sm:text-left">
              <div>
                <span className="text-2xl sm:text-3xl font-black text-white block">100%</span>
                <span className="text-xs text-slate-400 font-medium">Approval Before Work</span>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-black text-brand-cyan block">9-Stage</span>
                <span className="text-xs text-slate-400 font-medium">Strict State Machine</span>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-black text-brand-orange block">₹ Paise</span>
                <span className="text-xs text-slate-400 font-medium">Precision Invoicing</span>
              </div>
            </div>
          </div>

          {/* Interactive Live Preview Card */}
          <div className="lg:col-span-5">
            <div className="bg-navy-900/90 border border-navy-700/80 rounded-3xl p-6 shadow-2xl backdrop-blur-xl relative space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-navy-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-navy-800 flex items-center justify-center text-brand-cyan">
                    <Car className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Swift Dzire VXi (2021)</h3>
                    <p className="text-xs text-slate-400">Reg: UP78-AK-1024</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Estimate Sent
                </span>
              </div>

              {/* Estimate Preview */}
              <div className="bg-navy-950/80 rounded-2xl p-4 border border-navy-800/80 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Coolant Sensor & Relay (OEM)</span>
                  <span className="font-bold text-white">₹1,800.00</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Diagnostic Inspection & Flush</span>
                  <span className="font-bold text-white">₹1,200.00</span>
                </div>
                <div className="pt-2 border-t border-navy-800/80 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-300 uppercase">Estimated Total</span>
                  <span className="text-lg font-black text-brand-orange">₹3,000.00</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Link
                  href="/login"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold text-center transition-all shadow-md shadow-emerald-600/20"
                >
                  Approve Estimate
                </Link>
                <Link
                  href="/login"
                  className="flex-1 py-2.5 rounded-xl bg-navy-800 hover:bg-navy-750 text-slate-300 text-xs font-semibold text-center border border-navy-700 transition-all"
                >
                  Ask Revision
                </Link>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-center gap-2 pt-1">
                <ShieldCheck className="w-4 h-4 text-brand-cyan" />
                Work commences ONLY upon customer approval
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9-Stage Workflow Section */}
      <section id="workflow" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-12 scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-orange">
            Strict State Machine
          </span>
          <h2 className="text-3xl font-extrabold text-navy-900 tracking-tight">
            How RepairHub Eliminates Guesswork & Verbal Disputes
          </h2>
          <p className="text-sm text-slate-600">
            Every step is recorded in an append-only audit trail and pushed in real-time via Socket.IO.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            {
              step: '01',
              title: 'Request Submitted',
              role: 'Customer',
              desc: 'Owner selects vehicle, repair category & describes problem with photos.',
            },
            {
              step: '02',
              title: 'Smart Assignment',
              role: 'Admin',
              desc: 'Rule-based ranking: available + skill match + verified garage minus active workload.',
            },
            {
              step: '03',
              title: 'Inspection & Diagnosis',
              role: 'Mechanic',
              desc: 'Mechanic receives job card, runs tests, and enters technical diagnosis.',
            },
            {
              step: '04',
              title: 'Estimate Approval',
              role: 'Customer',
              desc: 'Itemized parts & labour pricing. Work CANNOT start without approval.',
            },
            {
              step: '05',
              title: 'Work, QC & Payment',
              role: 'Mechanic & Customer',
              desc: 'Repairs done, QC passed, instant digital tax invoice, and test mode payment.',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-hover transition-all space-y-2.5 relative group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xl font-black text-brand-orange/40 group-hover:text-brand-orange transition-colors">
                  {item.step}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {item.role}
                </span>
              </div>
              <h3 className="text-sm font-bold text-navy-900">{item.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Platform Roles & Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-12 scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-cyan">
            Tailored Workspaces
          </span>
          <h2 className="text-3xl font-extrabold text-navy-900 tracking-tight">
            One Connected Platform for All 3 Garage Roles
          </h2>
          <p className="text-sm text-slate-600">
            RepairHub eliminates miscommunication with dedicated dashboards tailored for vehicle owners, mechanics, and workshop managers.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Role 1: Customer (Vehicle Owner) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-hover transition-all flex flex-col overflow-hidden group">
            <div className="p-8 bg-gradient-to-br from-emerald-500/10 via-slate-50 to-white border-b border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 shadow-sm">
                  <Car className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wide">
                  Vehicle Owners
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-navy-900">Customer Portal</h3>
                <p className="text-xs text-slate-500 mt-1">Total transparency, zero surprise bills & digital receipts.</p>
              </div>
            </div>

            <div className="p-8 flex-1 flex flex-col justify-between space-y-6">
              <ul className="space-y-3.5 text-xs text-slate-600">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span><strong>Multi-Vehicle Garage:</strong> Register your cars, bikes & commercial vehicles with instant RC details.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span><strong>1-Click Estimate Approval:</strong> Review itemized parts & labour pricing. Work starts only after your consent.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span><strong>Real-Time Bay Tracker:</strong> Live Socket.IO milestone updates from inspection to final QC.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span><strong>PDF Tax Invoices & UPI:</strong> Test digital payments with instantly downloadable GST-compliant invoices.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span><strong>Mechanic Ratings & History:</strong> Verified 5-star reviews and lifelong service records for resale value.</span>
                </li>
              </ul>

              <div className="pt-4 border-t border-slate-100">
                <Link
                  href="/login?email=arun.customer@gmail.com"
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  Explore Customer Experience <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>

          {/* Role 2: Mechanic (Bay Technician) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-hover transition-all flex flex-col overflow-hidden group">
            <div className="p-8 bg-gradient-to-br from-brand-cyan/15 via-slate-50 to-white border-b border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-brand-cyan/20 border border-brand-cyan/40 flex items-center justify-center text-cyan-700 shadow-sm">
                  <Wrench className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200 uppercase tracking-wide">
                  Workshop Mechanics
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-navy-900">Mechanic Bay Console</h3>
                <p className="text-xs text-slate-500 mt-1">Focus on technical repair without messy paperwork.</p>
              </div>
            </div>

            <div className="p-8 flex-1 flex flex-col justify-between space-y-6">
              <ul className="space-y-3.5 text-xs text-slate-600">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-brand-cyan mt-0.5 shrink-0" />
                  <span><strong>Digital Job Cards:</strong> Automated dispatch with customer complaint details, vehicle specs & symptoms.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-brand-cyan mt-0.5 shrink-0" />
                  <span><strong>Technical Diagnosis Logger:</strong> Enter diagnostic notes, OBD fault codes, and required component changes.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-brand-cyan mt-0.5 shrink-0" />
                  <span><strong>Line-Item Estimate Builder:</strong> Draft transparent pricing with part numbers, quantities & labour units.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-brand-cyan mt-0.5 shrink-0" />
                  <span><strong>1-Tap Status Progressions:</strong> Advance requests from Inspecting → In Progress → Quality Check.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-brand-cyan mt-0.5 shrink-0" />
                  <span><strong>Availability & Skills Matrix:</strong> Set active status and configure expertise across Engine, Brakes & Electrical.</span>
                </li>
              </ul>

              <div className="pt-4 border-t border-slate-100">
                <Link
                  href="/login?email=vikram.mechanic@repairhub.in"
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-cyan-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  Launch Mechanic Console <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>

          {/* Role 3: Admin (Operations Tower) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-hover transition-all flex flex-col overflow-hidden group">
            <div className="p-8 bg-gradient-to-br from-brand-orange/15 via-slate-50 to-white border-b border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-brand-orange/20 border border-brand-orange/40 flex items-center justify-center text-brand-orange shadow-sm">
                  <Building2 className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-orange-100 text-orange-800 border border-orange-200 uppercase tracking-wide">
                  Network Admins
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-navy-900">Admin Operations Tower</h3>
                <p className="text-xs text-slate-500 mt-1">Full control, automated assignments & financial oversight.</p>
              </div>
            </div>

            <div className="p-8 flex-1 flex flex-col justify-between space-y-6">
              <ul className="space-y-3.5 text-xs text-slate-600">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-brand-orange mt-0.5 shrink-0" />
                  <span><strong>Smart Assignment Algorithm:</strong> Pure rule-based ranking: Rating - (Workload × 0.5) + Skill Matching.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-brand-orange mt-0.5 shrink-0" />
                  <span><strong>Live Bay Analytics:</strong> Real-time KPI dashboard tracking revenue, volume, average turnaround & CSAT.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-brand-orange mt-0.5 shrink-0" />
                  <span><strong>Strict Audit Trail:</strong> Enforce 9-stage state machine transitions with zero skipped safety gates.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-brand-orange mt-0.5 shrink-0" />
                  <span><strong>Kanpur Garage Verification:</strong> Onboard workshop partners, configure bay quotas & monitor capacity.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-brand-orange mt-0.5 shrink-0" />
                  <span><strong>Customer Escalation Desk:</strong> Review and resolve complaints with end-to-end diagnosis logs.</span>
                </li>
              </ul>

              <div className="pt-4 border-t border-slate-100">
                <Link
                  href="/login?email=admin@repairhub.in"
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-brand-orange text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  Access Admin Tower <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Logins Section */}
      <section id="demo-logins" className="py-16 bg-navy-900 text-white px-4 sm:px-6 lg:px-8 scroll-mt-20">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-cyan">
              Instant Sandbox Access
            </span>
            <h2 className="text-3xl font-black text-white">Pre-Seeded Demo Credentials</h2>
            <p className="text-sm text-slate-400">
              All accounts use the password:{' '}
              <span className="font-mono bg-navy-950 px-2 py-0.5 rounded text-brand-orange font-bold border border-navy-800">
                Password123!
              </span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Admin */}
            <div className="bg-navy-950/80 p-6 rounded-2xl border border-navy-800 space-y-4 hover:border-brand-orange transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-brand-orange/20 text-brand-orange border border-brand-orange/30">
                  Administrator
                </span>
                <Building2 className="w-5 h-5 text-brand-orange" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Ramesh Gupta</h3>
                <p className="text-xs text-slate-400">admin@repairhub.in</p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Full analytics dashboard, mechanic ranking & auto-assign, garage verification, and complaint resolution.
              </p>
              <Link
                href="/login?email=admin@repairhub.in"
                className="w-full py-2.5 rounded-xl bg-navy-800 hover:bg-navy-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                Log In as Admin <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Mechanic */}
            <div className="bg-navy-950/80 p-6 rounded-2xl border border-navy-800 space-y-4 hover:border-brand-cyan transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30">
                  Senior Mechanic
                </span>
                <Wrench className="w-5 h-5 text-brand-cyan" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Vikram Sharma</h3>
                <p className="text-xs text-slate-400">vikram.mechanic@repairhub.in</p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Assigned jobs, skill editor, vehicle inspection, line-item estimate builder, and repair status progress.
              </p>
              <Link
                href="/login?email=vikram.mechanic@repairhub.in"
                className="w-full py-2.5 rounded-xl bg-navy-800 hover:bg-navy-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                Log In as Mechanic <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Customer */}
            <div className="bg-navy-950/80 p-6 rounded-2xl border border-navy-800 space-y-4 hover:border-emerald-400 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Vehicle Owner
                </span>
                <Car className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Arun Kumar</h3>
                <p className="text-xs text-slate-400">arun.customer@gmail.com</p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Manage multiple vehicles, create service requests, approve transparent estimates, test payment & download PDF invoice.
              </p>
              <Link
                href="/login?email=arun.customer@gmail.com"
                className="w-full py-2.5 rounded-xl bg-navy-800 hover:bg-navy-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                Log In as Customer <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-950 text-slate-400 py-10 border-t border-navy-800/60 px-4 sm:px-6 lg:px-8 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 RepairHub Platform. Built for Indian Independent Garages.</p>
          <div className="flex items-center gap-6 text-slate-400">
            <span>PostgreSQL + Prisma ORM</span>
            <span>Next.js App Router</span>
            <span>Socket.IO Live Sync</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
