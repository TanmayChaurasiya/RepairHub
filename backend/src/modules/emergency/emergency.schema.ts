import { z } from 'zod';
import { EmergencyCategory, EmergencyStatus, VehicleType } from '@prisma/client';

export const discoverProvidersSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  category: z.nativeEnum(EmergencyCategory).optional(),
  radiusKm: z.coerce.number().min(1).max(100).optional().default(15),
  vehicleType: z.nativeEnum(VehicleType).optional(),
});

export const createEmergencyRequestSchema = z.object({
  vehicleId: z.string().uuid('Valid vehicleId is required'),
  category: z.nativeEnum(EmergencyCategory),
  description: z.string().min(3, 'Description must be at least 3 characters').optional().default('Emergency roadside breakdown assistance requested'),
  pickupLatitude: z.number().min(-90).max(90).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  pickupLongitude: z.number().min(-180).max(180).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  pickupAddress: z.string().min(3, 'Pickup address is required'),
  photos: z.array(z.string()).optional().default([]),
  photoUrls: z.array(z.string()).optional().default([]),
  preferredMechanicId: z.string().uuid().optional(),
  preferredGarageId: z.string().uuid().optional(),
  searchRadiusKm: z.number().min(1).max(100).optional().default(15),
}).refine((data) => data.pickupLatitude !== undefined || data.latitude !== undefined, {
  message: 'Latitude is required',
  path: ['pickupLatitude'],
}).refine((data) => data.pickupLongitude !== undefined || data.longitude !== undefined, {
  message: 'Longitude is required',
  path: ['pickupLongitude'],
});

export const acceptEmergencySchema = z.object({
  note: z.string().optional(),
});

export const declineEmergencySchema = z.object({
  reason: z.string().min(3, 'A decline reason of at least 3 characters is required'),
});

export const updateEmergencyStatusSchema = z.object({
  targetStatus: z.nativeEnum(EmergencyStatus),
  note: z.string().optional(),
});

export const updateMechanicLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const reassignEmergencySchema = z.object({
  newMechanicId: z.string().uuid('Valid newMechanicId is required'),
  reason: z.string().min(5, 'A reassignment reason of at least 5 characters is required'),
});

export const cancelEmergencySchema = z.object({
  reason: z.string().min(3, 'Cancellation reason is required'),
});

export const toggleEmergencySettingsSchema = z.object({
  acceptsEmergency: z.boolean(),
  emergencyRadiusKm: z.number().min(1).max(100).optional(),
});
