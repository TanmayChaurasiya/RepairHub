import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  listGarages,
  getGarageDetails,
  registerGarage,
  createGarage,
  toggleGarageVerification,
} from './garage.controller.js';
import { createGarageSchema, registerGarageSchema } from './garage.schema.js';
import { authenticate, authorizeRoles } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

const router = Router();

// Public routes
router.get('/', listGarages);
router.post('/register', validateBody(registerGarageSchema), registerGarage);
router.get('/:id', getGarageDetails);

// Master Admin routes
router.post('/', authenticate, authorizeRoles(Role.ADMIN), validateBody(createGarageSchema), createGarage);
router.patch('/:id/verify', authenticate, authorizeRoles(Role.ADMIN), toggleGarageVerification);

export default router;
