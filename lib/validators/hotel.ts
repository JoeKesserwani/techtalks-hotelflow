import { z } from 'zod';

export const updateHotelSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  timezone: z.string().min(1).max(50).optional(),
  currency: z.string().min(1).max(10).optional(),
});
