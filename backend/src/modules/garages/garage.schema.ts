import { z } from 'zod';

export const createGarageSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().optional(),
  pinCode: z.string().optional(),
  phone: z.string().min(10, 'Phone must be at least 10 characters'),
  description: z.string().optional(),
  operatingHours: z.string().optional(),
  services: z.array(z.string()).optional().default([]),
  isVerified: z.boolean().optional().default(false),
  ownerEmail: z.string().email().optional(),
});

export const registerGarageSchema = z.object({
  ownerName: z.string().min(2, 'Owner name must be at least 2 characters'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(10, 'Phone must be at least 10 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),

  garageName: z.string().min(2, 'Garage name is required'),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().optional().default('Uttar Pradesh'),
  pinCode: z.string().optional(),
  garagePhone: z.string().optional(),
  description: z.string().optional(),
  operatingHours: z.string().optional().default('09:00 AM - 08:00 PM (Mon - Sat)'),
  services: z.array(z.string()).optional().default([]),
});

export const updateGarageProfileSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().min(5).optional(),
  city: z.string().min(2).optional(),
  state: z.string().optional(),
  pinCode: z.string().optional(),
  phone: z.string().min(10).optional(),
  description: z.string().optional(),
  operatingHours: z.string().optional(),
  services: z.array(z.string()).optional(),
});
