import { z } from 'zod';

export const createReservationSchema = z
  .object({
    roomId: z.string().uuid(),
    guestId: z.string().uuid(),
    checkInDate: z.coerce.date(),
    checkOutDate: z.coerce.date(),
  })
  .refine((data) => data.checkOutDate > data.checkInDate, {
    message: 'checkOutDate must be after checkInDate',
    path: ['checkOutDate'],
  });

export const updateReservationSchema = z.object({
  status: z.enum(['BOOKED', 'CANCELLED', 'NO_SHOW']).optional(),
  checkInDate: z.coerce.date().optional(),
  checkOutDate: z.coerce.date().optional(),
});
