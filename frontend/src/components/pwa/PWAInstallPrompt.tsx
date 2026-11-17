'use client';

import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Smartphone, CheckCircle, Wrench } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true); // default true until verified
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    if (typeof window === 'undefined') return;

    // Check standalone display mode (already installed & running as standalone app)
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      return isStandaloneMedia || isIOSStandalone;
    };

    const standalone = checkStandalone();
    setIsStandalone(standalone);

    if (standalone) {
      return; // Do not show any install prompt if already installed
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // Check if dismissed recently (e.g. within 3 days)
    const dismissedTime = localStorage.getItem('repairhub_pwa_dismissed');
    if (dismissedTime) {
      const elapsed = Date.now() - parseInt(dismissedTime, 10);
      if (elapsed < 3 * 24 * 60 * 60 * 1000) {
        setIsDismissed(true);
      } else {
        setIsDismissed(false);
      }
    } else {
      setIsDismissed(false);
    }

    // Capture Android / Chromium beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // App installed event
    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      localStorage.removeItem('repairhub_pwa_dismissed');
      console.log('[PWA] RepairHub was successfully installed!');
    };

    // Custom trigger event from header/sidebar buttons
    const handleCustomTrigger = () => {
      setIsDismissed(false);
      if (isIOS) {
        setShowIOSModal(true);
      } else if (deferredPrompt) {
        handleInstallClick();
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('repairhub:trigger-pwa-install', handleCustomTrigger);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('repairhub:trigger-pwa-install', handleCustomTrigger);
    };
  }, [isIOS, deferredPrompt]);

  if (!isMounted || isStandalone || isDismissed) {
    return null;
  }

  // Only display if either Android prompt is available OR user is on iOS Safari
  if (!deferredPrompt && !isIOS) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        console.log('[PWA] User accepted installation prompt');
        setDeferredPrompt(null);
      } else {
        console.log('[PWA] User dismissed installation prompt');
      }
    } catch (err) {
      console.warn('[PWA] Installation prompt error:', err);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('repairhub_pwa_dismissed', Date.now().toString());
  };

  return (
    <>
      {/* Floating Bottom Install Banner (Responsive & Non-intrusive) */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 animate-slide-up">
        <div className="bg-navy-900/95 backdrop-blur-md border border-navy-800 rounded-2xl p-4 shadow-2xl shadow-black/80 flex items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-orange to-amber-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-brand-orange/30">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-white truncate">Install RepairHub App</p>
              <p className="text-[11px] text-slate-400 truncate">
                {isIOS ? 'Add to iPhone Home Screen' : 'Fast, fullscreen app experience'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleInstallClick}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-orange to-brand-orange-hover hover:brightness-110 active:scale-95 text-white font-bold text-xs shadow-md shadow-brand-orange/30 transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Install
            </button>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss banner"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Installation Instructions Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-navy-900 border border-navy-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-white shadow-2xl space-y-5 animate-slide-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-orange to-amber-500 flex items-center justify-center text-white">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold">Install on iPhone</h3>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Install RepairHub on your iOS device in Safari to open it as a native standalone app:
            </p>

            <ol className="space-y-3.5 text-xs text-slate-200">
              <li className="flex items-start gap-3 bg-navy-950/60 p-3 rounded-xl border border-navy-800/80">
                <div className="w-6 h-6 rounded-lg bg-navy-800 flex items-center justify-center text-brand-orange shrink-0 font-bold">
                  1
                </div>
                <div>
                  Tap the <strong className="text-white">Share</strong> button at the bottom of Safari <span className="inline-block p-1 bg-navy-800 rounded text-brand-cyan"><Share className="w-3 h-3 inline" /></span>.
                </div>
              </li>

              <li className="flex items-start gap-3 bg-navy-950/60 p-3 rounded-xl border border-navy-800/80">
                <div className="w-6 h-6 rounded-lg bg-navy-800 flex items-center justify-center text-brand-orange shrink-0 font-bold">
                  2
                </div>
                <div>
                  Scroll down and tap <strong className="text-white">Add to Home Screen</strong> <span className="inline-block p-1 bg-navy-800 rounded text-brand-orange"><PlusSquare className="w-3 h-3 inline" /></span>.
                </div>
              </li>

              <li className="flex items-start gap-3 bg-navy-950/60 p-3 rounded-xl border border-navy-800/80">
                <div className="w-6 h-6 rounded-lg bg-navy-800 flex items-center justify-center text-brand-orange shrink-0 font-bold">
                  3
                </div>
                <div>
                  Tap <strong className="text-white">Add</strong> in the top-right corner to complete.
                </div>
              </li>
            </ol>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-3 px-4 rounded-xl bg-navy-800 hover:bg-navy-700 text-white font-bold text-xs transition-colors"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function InstallAppButton({ className }: { className?: string }) {
  const [isStandalone, setIsStandalone] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
  }, []);

  if (isStandalone) return null;

  return (
    <button
      onClick={() => {
        window.dispatchEvent(new CustomEvent('repairhub:trigger-pwa-install'));
      }}
      className={
        className ||
        'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-brand-orange/15 text-brand-orange hover:bg-brand-orange/25 border border-brand-orange/30 transition-all'
      }
    >
      <Download className="w-3.5 h-3.5" />
      Install App
    </button>
  );
}
