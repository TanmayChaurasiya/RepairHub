import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  createOrSendEstimate,
  decideEstimate,
  reopenEstimate,
} from './estimate.controller.js';
import { createEstimateSchema, estimateDecisionSchema } from './estimate.schema.js';
import { authenticate, authorizeRoles } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

const router = Router();

router.use(authenticate);

// Mechanic creates or sends estimate for a request
router.post(
  '/request/:requestId',
  authorizeRoles(Role.MECHANIC, Role.ADMIN),
  validateBody(createEstimateSchema),
  createOrSendEstimate
);

// Mechanic reopens estimate to revise
router.post(
  '/request/:requestId/reopen',
  authorizeRoles(Role.MECHANIC, Role.ADMIN),
  reopenEstimate
);

// Customer approves or rejects estimate
router.post(
  '/:estimateId/decision',
  authorizeRoles(Role.CUSTOMER, Role.ADMIN),
  validateBody(estimateDecisionSchema),
  decideEstimate
);

export default router;
