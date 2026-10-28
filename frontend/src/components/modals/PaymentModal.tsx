'use client';

import React, { useState } from 'react';
import { X, CreditCard, ShieldCheck, CheckCircle2, Lock } from 'lucide-react';
import { formatINR } from '../../lib/utils';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';

export function PaymentModal({
  requestId,
  invoiceNumber,
  totalPaise,
  isOpen,
  onClose,
  onPaymentSuccess,
}: {
  requestId: string;
  invoiceNumber: string;
  totalPaise: number;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (data: any) => void;
}) {
  const [method, setMethod] = useState<'UPI' | 'CARD' | 'NETBANKING'>('UPI');
  const [processing, setProcessing] = useState(false);
  const { success, error } = useToast();

  if (!isOpen) return null;

  const handlePay = async () => {
    try {
      setProcessing(true);

      // Step 1: Create order with payment provider interface
      const orderRes = await api.post<{ orderId: string; amountPaise: number }>('/payments/create-order', {
        requestId,
      });

      // Simulated network processing delay
      await new Promise((r) => setTimeout(r, 800));

      // Step 2: Confirm mock payment
      const paymentId = `PAY_MOCK_${method}_${Date.now()}`;
      const confirmRes = await api.post<any>('/payments/confirm', {
        requestId,
        orderId: orderRes.orderId,
        paymentId,
      });

      success('Payment successful! Digital tax invoice generated.');
      onPaymentSuccess(confirmRes);
      onClose();
    } catch (err: any) {
      error(err.message || 'Payment processing failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 overflow-hidden space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-navy-900">Secure Digital Payment</h2>
              <p className="text-[11px] text-slate-500">Test Payment Gateway (Sandbox Mode)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Invoice Summary Banner */}
        <div className="bg-navy-900 text-white rounded-xl p-4 flex items-center justify-between shadow-inner">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
              Invoice #{invoiceNumber}
            </span>
            <span className="text-xs text-brand-cyan">Verified Repair Completed</span>
          </div>
          <div className="text-right">
            <span className="text-xl font-black text-brand-orange">{formatINR(totalPaise)}</span>
            <span className="text-[10px] text-slate-400 block">All Taxes Included</span>
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-navy-900 block">Choose Payment Method</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'UPI', label: 'UPI / QR' },
              { id: 'CARD', label: 'Debit / Credit' },
              { id: 'NETBANKING', label: 'NetBanking' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMethod(opt.id as any)}
                className={`py-2.5 px-2 rounded-xl text-xs font-semibold border text-center transition-all ${
                  method === opt.id
                    ? 'border-brand-orange bg-orange-50/60 text-brand-orange font-bold ring-2 ring-brand-orange/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Method details simulation */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
          <div className="flex items-center gap-1.5 text-navy-900 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            256-bit Encrypted Mock Gateway
          </div>
          <p className="text-[11px] text-slate-500">
            This transaction uses the test-mode provider interface. Instant settlement simulates live Razorpay webhooks.
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            disabled={processing}
            onClick={handlePay}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing Payment...
              </span>
            ) : (
              <>
                <Lock className="w-4 h-4" /> Pay {formatINR(totalPaise)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
