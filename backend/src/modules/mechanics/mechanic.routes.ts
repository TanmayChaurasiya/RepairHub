import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  listMechanics,
  createMechanic,
  toggleAvailability,
  updateSkills,
} from './mechanic.controller.js';
import {
  createMechanicSchema,
  updateAvailabilitySchema,
  updateSkillsSchema,
} from './mechanic.schema.js';
import { authenticate, authorizeRoles } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

const router = Router();

router.use(authenticate);

router.get('/', authorizeRoles(Role.ADMIN, Role.MECHANIC), listMechanics);
router.post('/', authorizeRoles(Role.ADMIN), validateBody(createMechanicSchema), createMechanic);
router.patch('/availability', authorizeRoles(Role.MECHANIC), validateBody(updateAvailabilitySchema), toggleAvailability);
router.patch('/skills', authorizeRoles(Role.MECHANIC), validateBody(updateSkillsSchema), updateSkills);

export default router;
