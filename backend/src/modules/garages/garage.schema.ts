import { z } from 'zod';

export const createGarageSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  phone: z.string().min(10, 'Phone must be at least 10 characters'),
  isVerified: z.boolean().optional().default(false),
});
