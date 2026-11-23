import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';

import { env } from './config/env.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './modules/auth/auth.routes.js';
import vehicleRoutes from './modules/vehicles/vehicle.routes.js';
import garageRoutes from './modules/garages/garage.routes.js';
import mechanicRoutes from './modules/mechanics/mechanic.routes.js';
import requestRoutes from './modules/requests/request.routes.js';
import estimateRoutes from './modules/estimates/estimate.routes.js';
import invoiceRoutes from './modules/invoices/invoice.routes.js';
import paymentRoutes from './modules/payments/payment.routes.js';
import reviewRoutes from './modules/reviews/review.routes.js';
import complaintRoutes from './modules/complaints/complaint.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import garageOwnerRoutes from './modules/garageOwner/garageOwner.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import emergencyRoutes from './modules/emergency/emergency.routes.js';

export function createApp(): Express {
  const app = express();
  app.set('trust proxy', 1);

  // Security Headers & Cross-Origin settings
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );


  app.use(
    cors({
      origin: [
        env.CORS_ORIGIN,
        'https://repair-hub-ecru.vercel.app',
        'https://repairhub-mobile-frontend.vercel.app',
        'https://repair-4d27v0bfo-tanmay-chaurasiya-s-projects.vercel.app',
        'https://repairhub-mobile-frontend-m21nmsb1f.vercel.app',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        /\.trycloudflare\.com$/,
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );



  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Static files for local photo uploads
  const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
  app.use('/uploads', express.static(uploadDir));

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'RepairHub API',
      timestamp: new Date().toISOString(),
    });
  });

  // Apply rate limiter to API routes
  app.use('/api', apiLimiter);

  // Mount Application Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/vehicles', vehicleRoutes);
  app.use('/api/garages', garageRoutes);
  app.use('/api/mechanics', mechanicRoutes);
  app.use('/api/requests', requestRoutes);
  app.use('/api/estimates', estimateRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/complaints', complaintRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/garage', garageOwnerRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/emergency', emergencyRoutes);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
  });

  // Global structured error handler
  app.use(errorHandler);

  return app;
}
