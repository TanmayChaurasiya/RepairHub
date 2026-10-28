import { Router } from 'express';
import { Role } from '@prisma/client';
import { listGarages, createGarage, toggleGarageVerification } from './garage.controller.js';
import { createGarageSchema } from './garage.schema.js';
import { authenticate, authorizeRoles } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

const router = Router();

router.get('/', listGarages);
router.post('/', authenticate, authorizeRoles(Role.ADMIN), validateBody(createGarageSchema), createGarage);
router.patch('/:id/verify', authenticate, authorizeRoles(Role.ADMIN), toggleGarageVerification);

export default router;
