import { z } from 'zod';

export const createRoomSchema = z.object({
  roomNumber: z.string().min(1).max(20),
  roomType: z.string().min(1).max(50),
  floor: z.coerce.number().int().positive(),
  capacity: z.coerce.number().int().positive(),
  basePrice: z.coerce.number().positive(),
});

// Manager full edit — any field, used on PATCH /rooms/:id
export const updateRoomSchema = z.object({
  roomNumber: z.string().min(1).max(20).optional(),
  roomType: z.string().min(1).max(50).optional(),
  basePrice: z.coerce.number().positive().optional(),
  floor: z.coerce.number().int().optional(),
  capacity: z.coerce.number().int().optional(),
  status: z
    .enum(['AVAILABLE', 'RESERVED', 'OCCUPIED','IN_REVIEW', 'NEEDS_CLEANING', 'CLEANING', 'OUT_OF_SERVICE'])
    .optional(),
});

// Housekeeping restricted edit — status only
export const updateRoomStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'RESERVED', 'OCCUPIED' ,'IN_REVIEW', 'NEEDS_CLEANING', 'CLEANING', 'OUT_OF_SERVICE']),
});
