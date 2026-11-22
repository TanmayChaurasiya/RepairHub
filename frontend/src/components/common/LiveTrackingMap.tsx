'use client';

import dynamic from 'next/dynamic';
import React from 'react';

export * from '../emergency/EmergencyMap';

const LiveTrackingMap = dynamic(() => import('../emergency/EmergencyMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[360px] rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200">
      <div className="w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default LiveTrackingMap;
