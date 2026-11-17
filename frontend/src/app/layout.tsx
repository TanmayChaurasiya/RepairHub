import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { ServiceWorkerRegistration } from '../components/pwa/ServiceWorkerRegistration';
import { PWAInstallPrompt } from '../components/pwa/PWAInstallPrompt';

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'RepairHub — Vehicle Repair & Service Management Platform',
  description:
    'Connected digital workflow between vehicle owners, mechanics, and garages in India. Transparent estimates, live repair status, smart assignment & digital invoices.',
  manifest: '/manifest.webmanifest',
  applicationName: 'RepairHub',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RepairHub',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased min-h-screen">
        <AuthProvider>
          <ToastProvider>
            {children}
            <ServiceWorkerRegistration />
            <PWAInstallPrompt />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
