import { z } from 'zod';

export const createPaymentOrderSchema = z.object({
  requestId: z.string().uuid('Valid requestId is required'),
});

export const confirmPaymentSchema = z.object({
  requestId: z.string().uuid('Valid requestId is required'),
  orderId: z.string().min(1, 'orderId is required'),
  paymentId: z.string().min(1, 'paymentId is required'),
  signature: z.string().optional(),
});
