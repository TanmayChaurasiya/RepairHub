import { z } from 'zod';
import { RepairCategory, RequestStatus } from '@prisma/client';

export const createRequestSchema = z.object({
  vehicleId: z.string().uuid('Valid vehicleId is required'),
  garageId: z.string().uuid('Valid garageId is required'),
  category: z.nativeEnum(RepairCategory),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  photos: z.array(z.string()).optional().default([]),
});

export const assignMechanicSchema = z.object({
  mechanicId: z.string().uuid().optional(),
  autoAssign: z.boolean().optional().default(false),
  note: z.string().optional(),
});

export const transitionStatusSchema = z.object({
  targetStatus: z.nativeEnum(RequestStatus),
  note: z.string().optional(),
});

export const updateDiagnosisSchema = z.object({
  diagnosis: z.string().min(5, 'Diagnosis must be at least 5 characters'),
});
