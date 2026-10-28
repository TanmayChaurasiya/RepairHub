import { Router } from 'express';
import { Role } from '@prisma/client';
import { listComplaints, createComplaint, resolveComplaint } from './complaint.controller.js';
import { createComplaintSchema, resolveComplaintSchema } from './complaint.schema.js';
import { authenticate, authorizeRoles } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

const router = Router();

router.use(authenticate);

router.get('/', listComplaints);
router.post('/', authorizeRoles(Role.CUSTOMER, Role.ADMIN), validateBody(createComplaintSchema), createComplaint);
router.patch('/:id/resolve', authorizeRoles(Role.ADMIN), validateBody(resolveComplaintSchema), resolveComplaint);

export default router;
