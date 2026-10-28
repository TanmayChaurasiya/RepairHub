import { z } from 'zod';

export const createComplaintSchema = z.object({
  requestId: z.string().uuid('Valid requestId is required'),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
});

export const resolveComplaintSchema = z.object({
  resolutionNote: z.string().min(5, 'Resolution note must be at least 5 characters'),
});
