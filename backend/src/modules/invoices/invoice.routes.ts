import { Router } from 'express';
import { getInvoiceById, downloadInvoicePdf } from './invoice.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/:id', getInvoiceById);
router.get('/:id/pdf', downloadInvoicePdf);

export default router;
