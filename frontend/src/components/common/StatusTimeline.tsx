'use client';

import React from 'react';
import { CheckCircle2, Clock, XCircle, ArrowRight } from 'lucide-react';
import { formatDate } from '../../lib/utils';

export interface HistoryItem {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorRole: string;
  note: string | null;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    role: string;
  };
}

const LINEAR_STAGES = [
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'INSPECTING', label: 'Inspecting' },
  { key: 'ESTIMATE_SENT', label: 'Estimate Sent' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'QC', label: 'Quality Check' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'PAID', label: 'Paid' },
];

export function StatusTimeline({
  currentStatus,
  history = [],
}: {
  currentStatus: string;
  history?: HistoryItem[];
}) {
  const isRejected = currentStatus === 'REJECTED';
  const isCancelled = currentStatus === 'CANCELLED';

  const currentIndex = LINEAR_STAGES.findIndex((s) => s.key === currentStatus);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-navy-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-brand-orange" />
          Repair Progress & Timeline
        </h3>
        {isRejected && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            Estimate Rejected by Owner
          </span>
        )}
        {isCancelled && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            <XCircle className="w-3.5 h-3.5 text-gray-500" />
            Request Cancelled
          </span>
        )}
      </div>

      {/* Progress Stepper Bar (Horizontal on desktop, scrollable on mobile) */}
      <div className="overflow-x-auto pb-4 pt-2">
        <div className="min-w-[700px] flex items-center justify-between relative">
          {LINEAR_STAGES.map((stage, idx) => {
            const isCompleted = currentIndex > idx || currentStatus === 'PAID';
            const isCurrent = currentIndex === idx;

            return (
              <div key={stage.key} className="flex flex-col items-center relative z-10 flex-1">
                {/* Connecting Line */}
                {idx > 0 && (
                  <div
                    className={`absolute top-4 -left-1/2 w-full h-1 -z-10 transition-colors ${
                      currentIndex >= idx ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                )}

                {/* Node Icon */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                    isCompleted
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                      : isCurrent
                        ? 'bg-brand-orange text-white ring-4 ring-brand-orange/20 shadow-md animate-pulse'
                        : 'bg-slate-100 text-slate-400 border border-slate-300'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                </div>

                {/* Stage Label */}
                <span
                  className={`text-xs mt-2 text-center font-medium ${
                    isCurrent
                      ? 'text-brand-orange font-bold'
                      : isCompleted
                        ? 'text-emerald-700 font-semibold'
                        : 'text-slate-400'
                  }`}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Append-only Status History Feed */}
      <div className="border-t border-slate-100 pt-5 space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Audit Trail & Activity Log
        </h4>

        {history.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No transition history logged yet.</p>
        ) : (
          <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {history.map((item) => (
              <div key={item.id} className="relative group">
                <span className="absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full bg-brand-cyan ring-4 ring-white" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-navy-900">
                      {item.fromStatus ? `${item.fromStatus} → ` : ''}
                      {item.toStatus}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {item.actorRole}
                    </span>
                    {item.actor && (
                      <span className="text-xs text-slate-500 font-normal">
                        by {item.actor.name}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {formatDate(item.createdAt)}
                  </span>
                </div>
                {item.note && (
                  <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2.5 mt-1.5 border border-slate-100">
                    "{item.note}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
