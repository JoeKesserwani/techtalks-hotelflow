import { z } from "zod";

export const createReservationSchema = z
  .object({
    roomId: z.string().uuid(),

    guestId: z.string().uuid(),

    checkInDate: z.coerce.date(),

    checkOutDate: z.coerce.date(),

    paymentStatus: z
      .enum(["UNPAID", "PARTIAL", "PAID"])
      .optional()
      .default("UNPAID"),
  })
  .refine((data) => data.checkOutDate > data.checkInDate, {
    message: "Check-out date must be after check-in date",
    path: ["checkOutDate"],
  });

export const updateReservationSchema = z
  .object({
    status: z.enum(["BOOKED", "CANCELLED", "NO_SHOW"]).optional(),

    checkInDate: z.coerce.date().optional(),

    checkOutDate: z.coerce.date().optional(),

    paymentStatus: z.enum(["UNPAID", "PARTIAL", "PAID"]).optional(),
  })
  .refine(
    (data) => {
      if (data.checkInDate && data.checkOutDate) {
        return data.checkOutDate > data.checkInDate;
      }

      return true;
    },
    {
      message: "Check-out date must be after check-in date",
      path: ["checkOutDate"],
    }
  );