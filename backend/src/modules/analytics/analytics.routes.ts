import { Router } from 'express';
import { Role } from '@prisma/client';
import { getAdminDashboardStats } from './analytics.controller.js';
import { authenticate, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.get('/dashboard', authorizeRoles(Role.ADMIN), getAdminDashboardStats);

export default router;
