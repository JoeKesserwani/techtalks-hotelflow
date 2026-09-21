import { z } from 'zod';

export const updateHotelSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  currency: z.string().optional(),
});