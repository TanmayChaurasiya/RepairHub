'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';

export function RaiseComplaintModal({
  requestId,
  isOpen,
  onClose,
  onComplaintRaised,
}: {
  requestId: string;
  isOpen: boolean;
  onClose: () => void;
  onComplaintRaised: (complaint: any) => void;
}) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { success, error } = useToast();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.length < 5 || description.length < 10) {
      error('Please provide a descriptive subject and details of your issue.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post<any>('/complaints', {
        requestId,
        subject,
        description,
      });
      success('Complaint registered. Our administrative team will review and resolve it promptly.');
      onComplaintRaised(res.complaint);
      onClose();
    } catch (err: any) {
      error(err.message || 'Failed to raise complaint');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 overflow-hidden space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-navy-900">Raise a Complaint / Ticket</h2>
              <p className="text-[11px] text-slate-500">Directly escalated to RepairHub administrative managers</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-navy-900 block mb-1">Subject</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Discrepancy regarding replaced part"
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-navy-900 block mb-1">Detailed Description</label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the issue encountered with your repair service or billing..."
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-rose-500/40 resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Register Complaint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ResolveComplaintModal({
  complaintId,
  isOpen,
  onClose,
  onResolved,
}: {
  complaintId: string;
  isOpen: boolean;
  onClose: () => void;
  onResolved: (updated: any) => void;
}) {
  const [resolutionNote, setResolutionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { success, error } = useToast();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resolutionNote.length < 5) {
      error('Resolution note must be at least 5 characters.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.patch<any>(`/complaints/${complaintId}/resolve`, {
        resolutionNote,
      });
      success('Complaint marked as resolved with official admin note.');
      onResolved(res.complaint);
      onClose();
    } catch (err: any) {
      error(err.message || 'Failed to resolve complaint');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 overflow-hidden space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-navy-900">Resolve Complaint</h2>
              <p className="text-[11px] text-slate-500">Provide administrative resolution note for customer</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-navy-900 block mb-1">Official Resolution Note</label>
            <textarea
              required
              rows={4}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="e.g. Investigated with garage manager. Mechanic applied protective coating at no charge."
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50"
            >
              {submitting ? 'Resolving...' : 'Confirm Resolution'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
