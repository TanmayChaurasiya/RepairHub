import { Router } from 'express';
import { listVehicles, getVehicleById, createVehicle, updateVehicle } from './vehicle.controller.js';
import { createVehicleSchema, updateVehicleSchema } from './vehicle.schema.js';
import { authenticate } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

const router = Router();

router.use(authenticate);

router.get('/', listVehicles);
router.get('/:id', getVehicleById);
router.post('/', validateBody(createVehicleSchema), createVehicle);
router.put('/:id', validateBody(updateVehicleSchema), updateVehicle);

export default router;
