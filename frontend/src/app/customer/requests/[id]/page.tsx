'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Wrench,
  Car,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  CreditCard,
  Star,
  AlertTriangle,
  Download,
  ShieldCheck,
  Phone,
  ArrowLeft,
  Building2,
  Calendar,
  Layers,
} from 'lucide-react';
import { AppLayout } from '../../../../components/layout/AppLayout';
import { StatusBadge } from '../../../../components/common/StatusBadge';
import { StatusTimeline } from '../../../../components/common/StatusTimeline';
import { CardSkeleton } from '../../../../components/common/LoadingSkeleton';
import { PaymentModal } from '../../../../components/modals/PaymentModal';
import { ReviewModal } from '../../../../components/modals/ReviewModal';
import { RaiseComplaintModal } from '../../../../components/modals/ComplaintModal';
import { api } from '../../../../lib/api';
import { formatINR, formatDate } from '../../../../lib/utils';
import { getSocket } from '../../../../lib/socket';
import { useToast } from '../../../../context/ToastContext';

export default function CustomerRequestDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { success, error } = useToast();

  const fetchRequest = async () => {
    try {
      setLoading(true);
      const data = await api.get<{ request: any }>(`/requests/${id}`);
      setRequest(data.request);
    } catch (err: any) {
      error(err.message || 'Failed to load request');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    fetchRequest();

    const socket = getSocket();
    if (!socket) return;

    // Join room for this specific request
    socket.emit('request:join', id);

    const onRequestUpdated = (updated: any) => {
      if (updated.id === id) {
        setRequest(updated);
        success(`Repair update: Status is now ${updated.status}`);
      }
    };

    socket.on('request:updated', onRequestUpdated);

    return () => {
      socket.emit('request:leave', id);
      socket.off('request:updated', onRequestUpdated);
    };
  }, [id]);

  const handleEstimateDecision = async (decision: 'APPROVE' | 'REJECT') => {
    if (!activeEstimate) return;

    try {
      setDeciding(true);
      const res = await api.post<any>(`/estimates/${activeEstimate.id}/decision`, {
        decision,
        customerNote: decision === 'REJECT' ? rejectNote.trim() : undefined,
      });

      success(
        decision === 'APPROVE'
          ? 'Estimate approved! The mechanic has been notified to start work.'
          : 'Estimate rejected. The mechanic will inspect and provide revisions.'
      );
      setRequest(res.request);
      setRejectModalOpen(false);
      setRejectNote('');
    } catch (err: any) {
      error(err.message || 'Failed to submit estimate decision');
    } finally {
      setDeciding(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!request?.invoice?.id) return;
    try {
      setDownloadingPdf(true);
      const blob = await api.get<Blob>(`/invoices/${request.invoice.id}/pdf`);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${request.invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      success('Invoice PDF downloaded!');
    } catch (err: any) {
      error('Failed to download invoice PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </AppLayout>
    );
  }

  if (!request) {
    return (
      <AppLayout>
        <div className="p-8 text-center space-y-4">
          <p className="text-sm text-slate-500">Repair request not found or access denied.</p>
          <Link href="/customer" className="text-xs font-bold text-brand-orange hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </AppLayout>
    );
  }

  // Find latest active estimate
  const activeEstimate = request.estimates?.[0];
  const canApproveOrReject = request.status === 'ESTIMATE_SENT' && activeEstimate?.status === 'SENT';
  const canPay = request.status === 'COMPLETED' && (!request.payment || request.payment.status !== 'SUCCESS');
  const canReview = request.status === 'PAID' && !request.review;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              href="/customer"
              className="text-xs font-bold text-slate-500 hover:text-navy-900 inline-flex items-center gap-1.5 mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to My Repairs
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-navy-900 font-mono">
                {request.requestNumber}
              </h1>
              <StatusBadge status={request.status} />
            </div>
            <p className="text-xs text-slate-500">
              Submitted on {formatDate(request.createdAt)}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Raise Complaint Action */}
            <button
              onClick={() => setComplaintModalOpen(true)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 hover:border-rose-400 bg-white hover:bg-rose-50/50 text-slate-700 hover:text-rose-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              Raise Complaint
            </button>

            {/* Download PDF button if invoice exists */}
            {request.invoice && (
              <button
                disabled={downloadingPdf}
                onClick={handleDownloadPdf}
                className="px-4 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-navy-900/10 transition-all disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-brand-cyan" />
                {downloadingPdf ? 'Generating PDF...' : 'Download Invoice PDF'}
              </button>
            )}
          </div>
        </div>

        {/* 9-Stage Visual Progress Timeline */}
        <StatusTimeline
          currentStatus={request.status}
          history={request.statusHistory}
        />

        {/* Action Callout Banners */}
        {/* 1. Estimate Approval Banner */}
        {canApproveOrReject && (
          <div className="bg-gradient-to-r from-amber-500 to-brand-orange text-white rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slide-up">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/20 text-white">
                Approval Required
              </span>
              <h3 className="text-lg font-black">
                Review Estimate v{activeEstimate.version} ({formatINR(activeEstimate.totalPaise)})
              </h3>
              <p className="text-xs text-amber-100 max-w-lg">
                Please inspect the line items below. The mechanic cannot start physical repairs until you approve this quote.
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                disabled={deciding}
                onClick={() => setRejectModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all"
              >
                Reject / Revise
              </button>
              <button
                disabled={deciding}
                onClick={() => handleEstimateDecision('APPROVE')}
                className="px-5 py-2.5 rounded-xl bg-white text-navy-900 hover:bg-slate-100 text-xs font-black shadow-lg transition-all"
              >
                {deciding ? 'Approving...' : '✓ Approve Estimate'}
              </button>
            </div>
          </div>
        )}

        {/* 2. Ready for Payment Banner */}
        {canPay && (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slide-up">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/20 text-white">
                Work Completed
              </span>
              <h3 className="text-lg font-black">
                Vehicle Ready for Pickup — Pay {formatINR(request.invoice?.totalPaise || 0)}
              </h3>
              <p className="text-xs text-emerald-100 max-w-lg">
                All repairs and quality checks have passed. Pay securely to release your vehicle and obtain a tax invoice.
              </p>
            </div>
            <button
              onClick={() => setPaymentModalOpen(true)}
              className="px-6 py-3 rounded-xl bg-white text-emerald-800 hover:bg-slate-100 text-xs font-black shadow-lg flex items-center justify-center gap-2 transition-all shrink-0"
            >
              <CreditCard className="w-4 h-4 text-emerald-600" />
              Pay Now (Test Gateway)
            </button>
          </div>
        )}

        {/* 3. Review Prompt Banner */}
        {canReview && (
          <div className="bg-navy-900 text-white rounded-2xl p-5 shadow-lg border border-navy-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-orange/20 text-brand-orange flex items-center justify-center shrink-0">
                <Star className="w-5 h-5 fill-brand-orange" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">How was Vikram's repair service?</h3>
                <p className="text-xs text-slate-400">Rate your experience to help local Kanpur mechanics improve.</p>
              </div>
            </div>
            <button
              onClick={() => setReviewModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold shadow-md shadow-brand-orange/20"
            >
              Rate & Review
            </button>
          </div>
        )}

        {/* Two-Column Grid: Left (Estimate & Diagnosis), Right (Vehicle & Mechanic Details) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Technical Diagnosis Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-extrabold text-navy-900 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-brand-orange" />
                Mechanic Inspection & Diagnosis
              </h3>
              {request.diagnosis ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-navy-900 font-medium leading-relaxed">
                  {request.diagnosis}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Diagnosis will be recorded once the mechanic begins physical inspection.
                </p>
              )}
            </div>

            {/* Estimates Breakdown Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-navy-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-cyan" />
                  Itemized Digital Estimate
                </h3>
                {activeEstimate && (
                  <span className="text-xs font-mono font-bold text-slate-500">
                    Version #{activeEstimate.version}
                  </span>
                )}
              </div>

              {!activeEstimate ? (
                <div className="p-6 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-slate-200">
                  Estimate is being prepared by the mechanic.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">Kind</th>
                          <th className="py-2.5 px-4">Description</th>
                          <th className="py-2.5 px-4 text-center">Qty</th>
                          <th className="py-2.5 px-4 text-right">Unit Price</th>
                          <th className="py-2.5 px-4 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeEstimate.items.map((item: any) => (
                          <tr key={item.id} className="hover:bg-slate-50/60">
                            <td className="py-3 px-4">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  item.kind === 'LABOUR'
                                    ? 'bg-orange-50 text-brand-orange border border-orange-200'
                                    : 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                                }`}
                              >
                                {item.kind}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-medium text-navy-900">
                              {item.description}
                            </td>
                            <td className="py-3 px-4 text-center text-slate-600">
                              {item.quantity}
                            </td>
                            <td className="py-3 px-4 text-right text-slate-600">
                              {formatINR(item.unitPricePaise)}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-navy-900">
                              {formatINR(item.totalPaise)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Total Summary */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-navy-950 text-white">
                    <div>
                      <span className="text-xs uppercase tracking-wider font-bold text-slate-400 block">
                        Estimated Grand Total
                      </span>
                      <span className="text-[11px] text-brand-cyan">
                        Inclusive of parts, labour & Kanpur workshop handling
                      </span>
                    </div>
                    <span className="text-xl font-black text-brand-orange">
                      {formatINR(activeEstimate.totalPaise)}
                    </span>
                  </div>

                  {/* Customer Note if any */}
                  {activeEstimate.customerNote && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                      <strong>Owner Note:</strong> {activeEstimate.customerNote}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Photos & Attachments */}
            {request.photos && request.photos.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
                <h3 className="text-sm font-extrabold text-navy-900">Attached Photos</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {request.photos.map((photoUrl: string, idx: number) => (
                    <div
                      key={idx}
                      className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-video relative group"
                    >
                      <img
                        src={photoUrl.startsWith('http') ? photoUrl : `http://localhost:5000${photoUrl}`}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submitted Review Card (if already reviewed) */}
            {request.review && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-navy-900">Your Submitted Review</h3>
                  <div className="flex items-center gap-1 text-amber-500">
                    {[...Array(request.review.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-500" />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  "{request.review.comment}"
                </p>
                <span className="text-[10px] text-slate-400 block text-right">
                  Submitted on {formatDate(request.review.createdAt)}
                </span>
              </div>
            )}
          </div>

          {/* Right Column (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Vehicle Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Vehicle Details
              </span>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-navy-900 text-white flex items-center justify-center font-bold">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-navy-900">
                    {request.vehicle?.make || 'Vehicle'} {request.vehicle?.model || ''}
                  </h4>
                  <p className="text-xs font-mono font-bold text-brand-orange">
                    {request.vehicle?.regNo || 'N/A'}
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Category:</span>
                  <strong className="text-navy-900">{request.category}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Year:</span>
                  <strong className="text-navy-900">{request.vehicle?.year || 'N/A'}</strong>
                </div>
              </div>
            </div>

            {/* Garage Details */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Service Garage
              </span>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-cyan/20 text-brand-cyan flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5 text-cyan-800" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-navy-900">{request.garage.name}</h4>
                  <p className="text-xs text-slate-500">{request.garage.city}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 pt-1 border-t border-slate-100">
                {request.garage.address} | Ph: {request.garage.phone}
              </p>
            </div>

            {/* Assigned Mechanic */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Assigned Mechanic
              </span>
              {request.mechanic ? (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-brand-orange flex items-center justify-center font-bold text-sm">
                      {request.mechanic.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-navy-900">{request.mechanic.name}</h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {request.mechanic.phone}
                      </p>
                    </div>
                  </div>
                  {request.mechanic.mechanicProfile && (
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      Rating: {request.mechanic.mechanicProfile.rating.toFixed(1)} / 5.0 (
                      {request.mechanic.mechanicProfile.totalReviews} reviews)
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">
                  Awaiting mechanic assignment by Kanpur workshop manager.
                </div>
              )}
            </div>

            {/* Complaints List on this request */}
            {request.complaints && request.complaints.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Support Complaints ({request.complaints.length})
                </span>
                <div className="space-y-2.5">
                  {request.complaints.map((c: any) => (
                    <div key={c.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-navy-900">{c.subject}</strong>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            c.status === 'RESOLVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>
                      <p className="text-slate-600">{c.description}</p>
                      {c.resolutionNote && (
                        <div className="mt-1 pt-1 border-t border-slate-200 text-emerald-800 font-medium">
                          <strong>Admin Resolution:</strong> {c.resolutionNote}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-navy-900">Reject Estimate & Request Revisions</h3>
            <p className="text-xs text-slate-500">
              Please specify which items you would like changed or removed (e.g. aftermarket vs OEM parts).
            </p>
            <textarea
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="e.g. Please check if aftermarket brake pads can be used to lower cost..."
              className="w-full text-xs rounded-xl border border-slate-300 p-3 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-rose-500/40 resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deciding}
                onClick={() => handleEstimateDecision('REJECT')}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                {deciding ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {request.invoice && (
        <PaymentModal
          requestId={request.id}
          invoiceNumber={request.invoice.invoiceNumber}
          totalPaise={request.invoice.totalPaise}
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          onPaymentSuccess={(data) => {
            setRequest(data.request);
          }}
        />
      )}

      {/* Review Modal */}
      <ReviewModal
        requestId={request.id}
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        onReviewSubmitted={(review) => {
          setRequest((prev: any) => ({ ...prev, review }));
        }}
      />

      {/* Raise Complaint Modal */}
      <RaiseComplaintModal
        requestId={request.id}
        isOpen={complaintModalOpen}
        onClose={() => setComplaintModalOpen(false)}
        onComplaintRaised={(newComp) => {
          setRequest((prev: any) => ({
            ...prev,
            complaints: [newComp, ...(prev.complaints || [])],
          }));
        }}
      />
    </AppLayout>
  );
}
