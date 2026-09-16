import { z } from 'zod';

export const createHousekeepingTaskSchema = z.object({
  roomId: z.string().uuid(),
  assignedToUserId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

export const updateHousekeepingTaskSchema = z.object({
  assignedToUserId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});

export const completeHousekeepingTaskSchema = z.object({
  photos: z.array(z.string().url()).max(10).optional(),
});
