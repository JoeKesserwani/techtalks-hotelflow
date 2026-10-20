
import { z } from "zod";

export const createGuestSchema = z.object({
  fullName: z.string().trim().min(1).max(150),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional(),
  passportNumber: z.string().max(60).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});

export const updateGuestSchema = createGuestSchema.partial().extend({
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional(),
  passportNumber: z.string().max(60).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});
