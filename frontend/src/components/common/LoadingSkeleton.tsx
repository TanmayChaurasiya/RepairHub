'use client';

import React from 'react';

export function LoadingSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 rounded-lg ${className}`}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex justify-between items-center">
        <LoadingSkeleton className="h-5 w-32" />
        <LoadingSkeleton className="h-6 w-20 rounded-full" />
      </div>
      <LoadingSkeleton className="h-4 w-3/4" />
      <LoadingSkeleton className="h-4 w-1/2" />
      <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
        <LoadingSkeleton className="h-4 w-24" />
        <LoadingSkeleton className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-4 px-6"><LoadingSkeleton className="h-4 w-24" /></td>
      <td className="py-4 px-6"><LoadingSkeleton className="h-4 w-36" /></td>
      <td className="py-4 px-6"><LoadingSkeleton className="h-4 w-28" /></td>
      <td className="py-4 px-6"><LoadingSkeleton className="h-6 w-24 rounded-full" /></td>
      <td className="py-4 px-6"><LoadingSkeleton className="h-8 w-20 rounded-lg" /></td>
    </tr>
  );
}
