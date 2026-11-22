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
  getMechanicDetailsAdmin,
  suspendMechanicAdmin,
  reactivateMechanicAdmin,
  listCustomersAdmin,
  listAllBookingsAdmin,
  getAuditLogs,
  getGarageComparisonAnalytics,
  getAdminDashboardStats,
  listCustomerVehiclesAdmin,
  getVehicleDetailsAdmin,
  listEmailNotificationsAdmin,
  retryEmailNotificationAdmin,
  getEligibleMechanicsForReassignmentAdmin,
  reassignMechanicAdmin,
  getRequestAssignmentHistoryAdmin,
  listAllAssignmentHistoriesAdmin,
} from './admin.controller.js';
import { authenticate, requireMasterAdmin } from '../../middleware/auth.js';

const router = Router();

// All Master Admin routes require exclusive verified Master Admin authorization
router.use(authenticate, requireMasterAdmin);

// Dashboard overview statistics
router.get('/dashboard/stats', getAdminDashboardStats);

// Garage lifecycle management
router.get('/garages', listGaragesAdmin);
router.get('/garages/:id', getGarageDetailsAdmin);
router.post('/garages/:id/approve', approveGarage);
router.post('/garages/:id/reject', rejectGarage);
router.post('/garages/:id/suspend', suspendGarage);
router.post('/garages/:id/reactivate', reactivateGarage);

// Platform-wide mechanic oversight
router.get('/mechanics', listMechanicsAdmin);
router.get('/mechanics/:id', getMechanicDetailsAdmin);
router.post('/mechanics/:id/suspend', suspendMechanicAdmin);
router.post('/mechanics/:id/reactivate', reactivateMechanicAdmin);

// Platform-wide customers, customer vehicles & bookings
router.get('/customers', listCustomersAdmin);
router.get('/vehicles', listCustomerVehiclesAdmin);
router.get('/vehicles/:id', getVehicleDetailsAdmin);
router.get('/bookings', listAllBookingsAdmin);

// Reassignment & Assignment History
router.get('/requests/:id/eligible-mechanics', getEligibleMechanicsForReassignmentAdmin);
router.post('/requests/:id/reassign', reassignMechanicAdmin);
router.get('/requests/:id/assignment-history', getRequestAssignmentHistoryAdmin);
router.get('/assignment-history', listAllAssignmentHistoriesAdmin);

// Automated Email Notifications Log & Retry
router.get('/email-notifications', listEmailNotificationsAdmin);
router.post('/email-notifications/:id/retry', retryEmailNotificationAdmin);

// System Audit Logs & Comparative Analytics
router.get('/audit-logs', getAuditLogs);
router.get('/analytics/comparison', getGarageComparisonAnalytics);

export default router;

