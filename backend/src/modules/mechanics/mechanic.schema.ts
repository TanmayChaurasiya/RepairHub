import { z } from 'zod';
import { RepairCategory } from '@prisma/client';

export const createMechanicSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required').toLowerCase(),
  phone: z.string().min(10, 'Phone is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  garageId: z.string().uuid('Valid garageId is required'),
  skills: z.array(z.nativeEnum(RepairCategory)).min(1, 'At least one skill is required'),
});

export const updateAvailabilitySchema = z.object({
  available: z.boolean(),
});

export const updateSkillsSchema = z.object({
  skills: z.array(z.nativeEnum(RepairCategory)).min(1, 'At least one skill is required'),
});
