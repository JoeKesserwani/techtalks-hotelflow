import { z } from 'zod';

export const createUserSchema = z.object({
  fullName: z.string().min(1).max(150),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING']),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(1).max(150).optional(),
  role: z.enum(['MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(), // allows a manager to reset someone's password
});
