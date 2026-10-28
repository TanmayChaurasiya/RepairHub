import { Router } from 'express';
import { createPaymentOrder, confirmPayment } from './payment.controller.js';
import { createPaymentOrderSchema, confirmPaymentSchema } from './payment.schema.js';
import { authenticate } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

const router = Router();

router.use(authenticate);

router.post('/create-order', validateBody(createPaymentOrderSchema), createPaymentOrder);
router.post('/confirm', validateBody(confirmPaymentSchema), confirmPayment);

export default router;
