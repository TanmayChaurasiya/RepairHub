import { z } from 'zod';
import { EstimateItemKind } from '@prisma/client';

export const estimateItemSchema = z.object({
  kind: z.nativeEnum(EstimateItemKind),
  description: z.string().min(2, 'Description is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPricePaise: z.number().int().min(0, 'Unit price in paise must be non-negative'),
});

export const createEstimateSchema = z.object({
  items: z.array(estimateItemSchema).min(1, 'At least one line item is required'),
});

export const estimateDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  customerNote: z.string().optional(),
});
