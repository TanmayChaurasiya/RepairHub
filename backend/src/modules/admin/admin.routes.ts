import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  listGaragesAdmin,
  getGarageDetailsAdmin,
  approveGarage,
  rejectGarage,
  suspendGarage,
  reactivateGarage,
  listMechanicsAdmin,
  suspendMechanicAdmin,
  reactivateMechanicAdmin,
  listCustomersAdmin,
  listAllBookingsAdmin,
  getAuditLogs,
  getGarageComparisonAnalytics,
} from './admin.controller.js';
import { authenticate, requireMasterAdmin } from '../../middleware/auth.js';

const router = Router();

// All Master Admin routes require exclusive verified Master Admin authorization
router.use(authenticate, requireMasterAdmin);

// Garage lifecycle management
router.get('/garages', listGaragesAdmin);
router.get('/garages/:id', getGarageDetailsAdmin);
router.post('/garages/:id/approve', approveGarage);
router.post('/garages/:id/reject', rejectGarage);
router.post('/garages/:id/suspend', suspendGarage);
router.post('/garages/:id/reactivate', reactivateGarage);

// Platform-wide mechanic oversight
router.get('/mechanics', listMechanicsAdmin);
router.post('/mechanics/:id/suspend', suspendMechanicAdmin);
router.post('/mechanics/:id/reactivate', reactivateMechanicAdmin);

// Platform-wide customers & bookings
router.get('/customers', listCustomersAdmin);
router.get('/bookings', listAllBookingsAdmin);

// System Audit Logs & Comparative Analytics
router.get('/audit-logs', getAuditLogs);
router.get('/analytics/comparison', getGarageComparisonAnalytics);

export default router;

