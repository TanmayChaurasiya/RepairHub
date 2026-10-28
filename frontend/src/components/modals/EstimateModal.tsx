'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2, Calculator, Wrench, ShieldAlert } from 'lucide-react';
import { formatINR } from '../../lib/utils';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';

export interface EstimateLineItemInput {
  kind: 'LABOUR' | 'PART';
  description: string;
  quantity: number;
  unitPriceRupees: number;
}

export function EstimateModal({
  requestId,
  isOpen,
  onClose,
  onEstimateSent,
}: {
  requestId: string;
  isOpen: boolean;
  onClose: () => void;
  onEstimateSent: (data: any) => void;
}) {
  const [items, setItems] = useState<EstimateLineItemInput[]>([
    { kind: 'LABOUR', description: 'Diagnostic inspection & system scan', quantity: 1, unitPriceRupees: 500 },
    { kind: 'PART', description: 'Replacement Component OEM', quantity: 1, unitPriceRupees: 1200 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const { success, error } = useToast();

  if (!isOpen) return null;

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { kind: 'PART', description: '', quantity: 1, unitPriceRupees: 0 },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) {
      error('An estimate must have at least one line item.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof EstimateLineItemInput, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const totalPaise = items.reduce(
    (sum, item) => sum + Math.round((item.unitPriceRupees || 0) * 100) * (item.quantity || 1),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    for (const item of items) {
      if (!item.description.trim()) {
        error('Please enter a description for all line items.');
        return;
      }
      if (item.quantity <= 0) {
        error('Quantity must be at least 1.');
        return;
      }
      if (item.unitPriceRupees < 0) {
        error('Unit price cannot be negative.');
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        items: items.map((item) => ({
          kind: item.kind,
          description: item.description.trim(),
          quantity: Number(item.quantity),
          unitPricePaise: Math.round(Number(item.unitPriceRupees) * 100),
        })),
      };

      const res = await api.post<any>(`/estimates/request/${requestId}`, payload);
      success('Estimate created and sent to customer for transparent approval!');
      onEstimateSent(res);
      onClose();
    } catch (err: any) {
      error(err.message || 'Failed to submit estimate');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-brand-orange/10 flex items-center justify-center text-brand-orange">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy-900">Build Digital Estimate</h2>
              <p className="text-xs text-slate-500">Provide line-item transparent parts and labour pricing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4">
          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="bg-slate-50 rounded-xl p-3 border border-slate-200 grid grid-cols-12 gap-2.5 items-center"
              >
                {/* Kind */}
                <div className="col-span-12 sm:col-span-3">
                  <label className="text-[10px] font-semibold uppercase text-slate-500 block mb-1">
                    Kind
                  </label>
                  <select
                    value={item.kind}
                    onChange={(e) => updateItem(index, 'kind', e.target.value)}
                    className="w-full text-xs font-semibold rounded-lg border border-slate-300 py-1.5 px-2 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                  >
                    <option value="LABOUR">LABOUR</option>
                    <option value="PART">PART</option>
                  </select>
                </div>

                {/* Description */}
                <div className="col-span-12 sm:col-span-4">
                  <label className="text-[10px] font-semibold uppercase text-slate-500 block mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Brake Pads Replacement"
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 py-1.5 px-2.5 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                  />
                </div>

                {/* Qty */}
                <div className="col-span-4 sm:col-span-2">
                  <label className="text-[10px] font-semibold uppercase text-slate-500 block mb-1">
                    Qty
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-full text-xs rounded-lg border border-slate-300 py-1.5 px-2 bg-white text-navy-900 text-center focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                  />
                </div>

                {/* Unit Price in ₹ */}
                <div className="col-span-6 sm:col-span-2">
                  <label className="text-[10px] font-semibold uppercase text-slate-500 block mb-1">
                    Rate (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    required
                    value={item.unitPriceRupees}
                    onChange={(e) => updateItem(index, 'unitPriceRupees', parseFloat(e.target.value) || 0)}
                    className="w-full text-xs rounded-lg border border-slate-300 py-1.5 px-2 bg-white text-navy-900 text-right focus:outline-none focus:ring-2 focus:ring-brand-orange/50 font-medium"
                  />
                </div>

                {/* Remove */}
                <div className="col-span-2 sm:col-span-1 flex justify-center pt-4 sm:pt-4">
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-orange hover:text-brand-orange-hover py-2 px-3 rounded-lg border border-brand-orange/30 hover:border-brand-orange bg-orange-50/50 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Line Item
          </button>
        </form>

        {/* Footer & Live Total */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold text-slate-500">Estimate Total:</span>
            <span className="text-xl font-extrabold text-navy-900">{formatINR(totalPaise)}</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold shadow-md shadow-brand-orange/20 transition-all disabled:opacity-50"
            >
              {submitting ? 'Sending Estimate...' : 'Send Estimate to Owner'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
