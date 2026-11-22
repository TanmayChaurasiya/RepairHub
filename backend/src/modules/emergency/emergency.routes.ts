import { Router } from 'express';
import {
  discoverProviders,
  createEmergencyRequest,
  listEmergencyRequests,
  getEmergencyRequestById,
  acceptEmergencyRequest,
  declineEmergencyRequest,
  updateEmergencyStatus,
  updateMechanicLocation,
  adminReassignEmergency,
  cancelEmergencyRequest,
  toggleProviderEmergencySettings,
} from './emergency.controller.js';
import {
  createEmergencyRequestSchema,
  declineEmergencySchema,
  updateEmergencyStatusSchema,
  updateMechanicLocationSchema,
  reassignEmergencySchema,
  cancelEmergencySchema,
  toggleEmergencySettingsSchema,
} from './emergency.schema.js';
import { authenticate, authorizeRoles, requireMasterAdmin } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

// 1. Discovery & Search
router.get('/nearby', discoverProviders);

// 2. Incident Requests Lifecycle
router.post(
  '/requests',
  authorizeRoles(Role.CUSTOMER, Role.ADMIN),
  validateBody(createEmergencyRequestSchema),
  createEmergencyRequest
);
router.get('/requests', listEmergencyRequests);
router.get('/requests/:id', getEmergencyRequestById);

// 3. Mechanic Operations
router.post(
  '/requests/:id/accept',
  authorizeRoles(Role.MECHANIC),
  acceptEmergencyRequest
);
router.post(
  '/requests/:id/decline',
  authorizeRoles(Role.MECHANIC),
  validateBody(declineEmergencySchema),
  declineEmergencyRequest
);
router.patch(
  '/requests/:id/status',
  authorizeRoles(Role.MECHANIC, Role.ADMIN),
  validateBody(updateEmergencyStatusSchema),
  updateEmergencyStatus
);
router.patch(
  '/requests/:id/location',
  authorizeRoles(Role.MECHANIC),
  validateBody(updateMechanicLocationSchema),
  updateMechanicLocation
);

// 4. Admin Command & Reassignment
router.post(
  '/requests/:id/reassign',
  requireMasterAdmin,
  validateBody(reassignEmergencySchema),
  adminReassignEmergency
);

// 5. Cancellation
router.post(
  '/requests/:id/cancel',
  validateBody(cancelEmergencySchema),
  cancelEmergencyRequest
);

// 6. Provider Availability & Roadside Toggle Settings
router.patch(
  '/provider/settings',
  authorizeRoles(Role.MECHANIC, Role.GARAGE),
  validateBody(toggleEmergencySettingsSchema),
  toggleProviderEmergencySettings
);

export default router;
