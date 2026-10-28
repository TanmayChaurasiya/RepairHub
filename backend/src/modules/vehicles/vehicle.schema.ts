import { z } from 'zod';
import { VehicleType } from '@prisma/client';

export const createVehicleSchema = z.object({
  type: z.nativeEnum(VehicleType),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  year: z.number().int().min(1980).max(new Date().getFullYear() + 1),
  regNo: z.string().min(4, 'Registration number is required').toUpperCase().trim(),
});

export const updateVehicleSchema = createVehicleSchema.partial();
