import { Router } from 'express';
import multer from 'multer';
import { Role } from '@prisma/client';
import {
  createRequest,
  listRequests,
  getRequestById,
  getMechanicSuggestions,
  assignMechanic,
  transitionStatus,
  updateDiagnosis,
  uploadRequestPhotos,
} from './request.controller.js';
import {
  createRequestSchema,
  assignMechanicSchema,
  transitionStatusSchema,
  updateDiagnosisSchema,
} from './request.schema.js';
import { authenticate, authorizeRoles } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const router = Router();

router.use(authenticate);

router.get('/', listRequests);
router.post('/', authorizeRoles(Role.CUSTOMER, Role.ADMIN), validateBody(createRequestSchema), createRequest);
router.get('/:id', getRequestById);

// Admin suggestions & assignment
router.get('/:id/suggestions', authorizeRoles(Role.ADMIN), getMechanicSuggestions);
router.post('/:id/assign', authorizeRoles(Role.ADMIN), validateBody(assignMechanicSchema), assignMechanic);

// Workflow state transition
router.post('/:id/transition', validateBody(transitionStatusSchema), transitionStatus);

// Mechanic diagnosis
router.put('/:id/diagnosis', authorizeRoles(Role.MECHANIC), validateBody(updateDiagnosisSchema), updateDiagnosis);

// Photo upload
router.post('/:id/photos', upload.array('photos', 5), uploadRequestPhotos);

export default router;
