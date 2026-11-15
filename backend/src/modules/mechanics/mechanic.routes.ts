import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  listMechanics,
  createMechanic,
  toggleAvailability,
  updateSkills,
  getInvitationDetails,
  acceptInvitation,
} from './mechanic.controller.js';
import {
  createMechanicSchema,
  updateAvailabilitySchema,
  updateSkillsSchema,
  acceptInvitationSchema,
} from './mechanic.schema.js';
import { authenticate, authorizeRoles } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

const router = Router();

// Public invitation routes (NO auth token needed)
router.get('/invitation/:token', getInvitationDetails);
router.post('/accept-invitation', validateBody(acceptInvitationSchema), acceptInvitation);

// Protected routes (require auth)
router.use(authenticate);

router.get('/', authorizeRoles(Role.ADMIN, Role.GARAGE, Role.MECHANIC), listMechanics);
router.post('/', authorizeRoles(Role.ADMIN), validateBody(createMechanicSchema), createMechanic);
router.patch('/availability', authorizeRoles(Role.MECHANIC), validateBody(updateAvailabilitySchema), toggleAvailability);
router.patch('/skills', authorizeRoles(Role.MECHANIC), validateBody(updateSkillsSchema), updateSkills);

export default router;
