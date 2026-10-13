import { prisma } from "../../../../../lib/db";
import { requireAuth } from "../../../../../lib/middleware/requireAuth";
import { updateReservationSchema } from "../../../../../lib/validators/reservation";
import { writeAuditLog } from "../../../../../lib/services/audit.service";
import { ApiError, handleRouteError } from "../../../../../lib/api/errors";

const HOTEL_TIME_ZONE = "Asia/Beirut";

/*
 * Return today's date in the hotel's timezone.
 *
 * Example:
 * 2026-09-23
 */
function getTodayString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HOTEL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/*
 * Convert a date-only string such as:
 *
 * 2026-09-23
 *
 * into a UTC Date.
 *
 * We intentionally use UTC midnight so that
 * date-only reservation values do not shift
 * because of the server timezone.
 */
function dateOnlyToUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

/*
 * Convert a Date from the database into
 * a date-only string in the hotel timezone.
 */
function dateToHotelDateString(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HOTEL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

/*
 * Convert either a Date or string into:
 *
 * YYYY-MM-DD
 */
function toDateOnlyString(value: string | Date) {
  if (value instanceof Date) {
    return dateToHotelDateString(value);
  }

  return value.split("T")[0];
}

/*
 * Calculate number of nights using date-only values.
 */
function calculateNights(checkInDate: string, checkOutDate: string) {
  const checkIn = dateOnlyToUtcDate(checkInDate);
  const checkOut = dateOnlyToUtcDate(checkOutDate);

  const difference = checkOut.getTime() - checkIn.getTime();

  return Math.ceil(difference / (1000 * 60 * 60 * 24));
}

/*
 * --------------------------------------------------
 * GET ONE RESERVATION
 * --------------------------------------------------
 */

export async function GET(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id } = await params;

    const user = await requireAuth({
      roles: ["ADMIN", "MANAGER", "RECEPTIONIST"],
    });

    if (!user) {
      throw new ApiError("Unauthorized", 401);
    }

    const reservation = await prisma.reservation.findFirst({
      where: {
        id,
        hotelId: user.hotelId,
      },

      include: {
        room: true,
        guest: true,
      },
    });

    if (!reservation) {
      throw new ApiError("Reservation not found", 404);
    }

    return Response.json(reservation);
  } catch (err) {
    return handleRouteError(err);
  }
}

/*
 * --------------------------------------------------
 * UPDATE RESERVATION
 * --------------------------------------------------
 */

export async function PATCH(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id } = await params;

    const user = await requireAuth({
      roles: ["ADMIN", "MANAGER", "RECEPTIONIST"],
    });

    if (!user) {
      throw new ApiError("Unauthorized", 401);
    }

    const body = await req.json();

    const parsed = updateReservationSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError("Invalid request body", 400);
    }

    const reservation = await prisma.reservation.findFirst({
      where: {
        id,
        hotelId: user.hotelId,
      },

      include: {
        room: true,
        guest: true,
      },
    });

    if (!reservation) {
      throw new ApiError("Reservation not found", 404);
    }

    /*
     * Use the submitted dates if they were provided.
     * Otherwise keep the existing dates.
     */
    const newCheckInDateString = parsed.data.checkInDate
      ? toDateOnlyString(parsed.data.checkInDate)
      : toDateOnlyString(reservation.checkInDate);

    const newCheckOutDateString = parsed.data.checkOutDate
      ? toDateOnlyString(parsed.data.checkOutDate)
      : toDateOnlyString(reservation.checkOutDate);

    /*
     * Check-in cannot be before today.
     */
    const todayString = getTodayString();

    if (newCheckInDateString < todayString) {
      throw new ApiError("Check-in date cannot be before today", 400);
    }

    /*
     * Check-out must be after check-in.
     */
    if (newCheckOutDateString <= newCheckInDateString) {
      throw new ApiError("Check-out date must be after check-in date", 400);
    }

    /*
     * Calculate nights using date-only values.
     */
    const nights = calculateNights(newCheckInDateString, newCheckOutDateString);

    if (nights <= 0) {
      throw new ApiError("Reservation must be at least one night", 400);
    }

    /*
     * Convert date-only strings to database Dates.
     */
    const newCheckInDate = dateOnlyToUtcDate(newCheckInDateString);

    const newCheckOutDate = dateOnlyToUtcDate(newCheckOutDateString);

    const updated = await prisma.$transaction(async (tx) => {
      /*
       * Get the room from the database.
       */
      const room = await tx.room.findFirst({
        where: {
          id: reservation.roomId,
          hotelId: user.hotelId,
        },
      });

      if (!room) {
        throw new ApiError("Room not found", 404);
      }

      /*
       * Prevent overlapping active reservations.
       *
       * CHECKED_OUT reservations are ignored.
       */
      const overlap = await tx.reservation.findFirst({
        where: {
          id: {
            not: id,
          },

          hotelId: user.hotelId,

          roomId: reservation.roomId,

          status: {
            in: ["BOOKED", "CHECKED_IN"],
          },

          checkInDate: {
            lt: newCheckOutDate,
          },

          checkOutDate: {
            gt: newCheckInDate,
          },
        },
      });

      if (overlap) {
        throw new ApiError("Room is already booked for those dates", 409);
      }

      /*
       * Price always comes from the room.
       */
      const pricePerNight = room.basePrice;

      const totalPrice = pricePerNight.mul(nights);

      /*
       * Keep the existing payment status
       * unless a new one was submitted.
       */
      const paymentStatus =
        parsed.data.paymentStatus ?? reservation.paymentStatus;

      /*
       * IMPORTANT:
       * Keep the current reservation status.
       */
      const result = await tx.reservation.update({
        where: {
          id,
        },

        data: {
          checkInDate: newCheckInDate,

          checkOutDate: newCheckOutDate,

          status: reservation.status,

          paymentStatus,

          pricePerNight,

          totalPrice,
        },

        include: {
          room: true,
          guest: true,
        },
      });

      /*
       * Do NOT change room status here.
       *
       * Check-in and check-out endpoints
       * control the physical room status.
       */

      await writeAuditLog(tx, {
        hotelId: user.hotelId,

        userId: user.userId,

        action: "RESERVATION_UPDATED",

        entityType: "reservation",

        metadata: {
          reservationId: id,

          status: reservation.status,

          changes: {
            checkInDate: newCheckInDateString,

            checkOutDate: newCheckOutDateString,

            paymentStatus,

            pricePerNight,

            totalPrice,
          },
        },
      });

      return result;
    });

    return Response.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

/*
 * --------------------------------------------------
 * DELETE RESERVATION
 * --------------------------------------------------
 */

export async function DELETE(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id } = await params;

    const user = await requireAuth({
      roles: ["ADMIN", "MANAGER", "RECEPTIONIST"],
    });

    if (!user) {
      throw new ApiError("Unauthorized", 401);
    }

    const reservation = await prisma.reservation.findFirst({
      where: {
        id,
        hotelId: user.hotelId,
      },
      include: {
        room: { select: { roomNumber: true } },
        guest: { select: { fullName: true } },
      },
    });

    if (!reservation) {
      throw new ApiError("Reservation not found", 404);
    }

    if (
      reservation.status === "CHECKED_OUT" &&
      user.role !== "ADMIN" &&
      user.role !== "MANAGER"
    ) {
      throw new ApiError(
        "Only admins and managers can delete completed reservations",
        403,
      );
    }

    await prisma.$transaction(async (tx) => {
      /*
       * Delete reservation.
       */
      await tx.reservation.delete({
        where: {
          id,
        },
      });

      /*
       * Check whether another active
       * reservation is using the same room.
       */
      const activeReservation = await tx.reservation.findFirst({
        where: {
          hotelId: user.hotelId,

          roomId: reservation.roomId,

          status: {
            in: ["BOOKED", "CHECKED_IN"],
          },
        },
      });

      /*
       * Only release a BOOKED reservation's room.
       *
       * We do not change the room for
       * CHECKED_IN or CHECKED_OUT reservations.
       */
      if (!activeReservation && reservation.status === "BOOKED") {
        await tx.room.update({
          where: {
            id: reservation.roomId,
          },

          data: {
            status: "AVAILABLE",
          },
        });
      }

      /*
       * Audit log.
       */
      await writeAuditLog(tx, {
        hotelId: user.hotelId,

        userId: user.userId,

        action: "RESERVATION_DELETED",

        entityType: "reservation",

        metadata: {
          reservationId: id,

          roomId: reservation.roomId,

          guestId: reservation.guestId,

          guestName: reservation.guest.fullName,

          roomNumber: reservation.room.roomNumber,

          checkInDate: reservation.checkInDate.toISOString().slice(0, 10),

          checkOutDate: reservation.checkOutDate.toISOString().slice(0, 10),

          previousStatus: reservation.status,

          totalPrice: reservation.totalPrice.toString(),

          paymentStatus: reservation.paymentStatus,
        },
      });
    });

    return Response.json({
      message: "Reservation deleted successfully",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
