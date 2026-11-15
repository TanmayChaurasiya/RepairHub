import { Router } from 'express';
import {
  getDashboardStats,
  getProfile,
  updateProfile,
  getBookings,
  assignMechanic,
  listMechanics,
  inviteMechanic,
  updateMechanicStatus,
} from './garageOwner.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveGarageOwnership, requireApprovedGarage } from '../../middleware/garageAuth.js';
import { validateBody } from '../../middleware/validate.js';
import { updateGarageProfileSchema } from '../garages/garage.schema.js';
import { z } from 'zod';

const inviteMechanicSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email address is required'),
  phone: z.string().min(10, 'Valid 10-digit phone number is required'),
  skills: z.array(z.string()).min(1, 'Select at least one skill'),
  specialization: z.string().optional(),
  experienceYears: z.number().min(0).optional(),
});

const assignMechanicSchema = z.object({
  mechanicId: z.string().uuid('Valid mechanic ID is required'),
});

const updateMechanicStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  available: z.boolean().optional(),
});

const router = Router();

// All garage owner routes require authentication and garage resolution
router.use(authenticate, resolveGarageOwnership);

// Profile is accessible even when status is PENDING (so user can check status)
router.get('/profile', getProfile);
router.put('/profile', validateBody(updateGarageProfileSchema), updateProfile);

// Operational routes require the garage to be APPROVED by Master Admin
router.get('/dashboard', requireApprovedGarage, getDashboardStats);
router.get('/bookings', requireApprovedGarage, getBookings);
router.post('/bookings/:id/assign', requireApprovedGarage, validateBody(assignMechanicSchema), assignMechanic);

// Mechanic management routes
router.get('/mechanics', requireApprovedGarage, listMechanics);
router.post('/mechanics/invite', requireApprovedGarage, validateBody(inviteMechanicSchema), inviteMechanic);
router.patch('/mechanics/:id/status', requireApprovedGarage, validateBody(updateMechanicStatusSchema), updateMechanicStatus);

export default router;

