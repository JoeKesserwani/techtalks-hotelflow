import { prisma } from "../../../../../../lib/db";
import { requireAuth } from "../../../../../../lib/middleware/requireAuth";
import { ApiError, handleRouteError } from "../../../../../../lib/api/errors";
import { writeAuditLog } from "../../../../../../lib/services/audit.service";

const HOTEL_TIME_ZONE = "Asia/Beirut";

/*
 * Get today's date according to the hotel's timezone.
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
 * Convert a date-only string to a UTC Date.
 *
 * Example:
 * "2026-09-23"
 * ->
 * 2026-09-23T00:00:00.000Z
 */
function dateOnlyToUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

/*
 * Convert a database Date into the hotel's
 * date-only value.
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
 * Calculate nights using date-only strings.
 */
function calculateNights(checkInDate: string, checkOutDate: string) {
  const checkIn = dateOnlyToUtcDate(checkInDate);

  const checkOut = dateOnlyToUtcDate(checkOutDate);

  const difference = checkOut.getTime() - checkIn.getTime();

  return Math.ceil(difference / (1000 * 60 * 60 * 24));
}

export async function POST(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id } = await params;

    /*
     * Only manager and receptionist can check out.
     */
    const user = await requireAuth({
      roles: ["ADMIN", "MANAGER", "RECEPTIONIST"],
    });

    if (!user) {
      throw new ApiError("Unauthorized", 401);
    }

    /*
     * Find reservation.
     */
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
     * If already checked out, simply return it.
     * This makes checkout safe to retry.
     */
    if (reservation.status === "CHECKED_OUT") {
      return Response.json(reservation);
    }

    /*
     * Checkout is only allowed for
     * a currently checked-in reservation.
     */
    if (reservation.status !== "CHECKED_IN") {
      throw new ApiError(
        "Only checked-in reservations can be checked out",
        400,
      );
    }

    /*
     * Today's date in Beirut.
     */
    const todayString = getTodayString();

    /*
     * Get the reservation's check-in date
     * in Beirut as YYYY-MM-DD.
     *
     * This avoids timezone problems.
     */
    const checkInDateString = dateToHotelDateString(reservation.checkInDate);

    /*
     * Checkout cannot happen before
     * the reservation's check-in date.
     *
     * Normally a CHECKED_IN reservation
     * should already have today's date,
     * but this validation protects the database.
     */
    if (todayString < checkInDateString) {
      throw new ApiError(
        "Check-out date cannot be before the check-in date",
        400,
      );
    }

    /*
     * Checkout date is TODAY.
     *
     * We do NOT use new Date() directly
     * as the database value because the server
     * timezone can be different from Beirut.
     */
    const checkOutDate = dateOnlyToUtcDate(todayString);

    /*
     * Calculate the number of nights.
     */
    const nights = calculateNights(checkInDateString, todayString);

    /*
     * At least one night.
     *
     * If a guest checked in today,
     * we still treat the stay as one night
     * for checkout purposes.
     */
    const finalNights = Math.max(1, nights);

    const updated = await prisma.$transaction(async (tx) => {
      /*
       * Price comes from the reservation.
       *
       * This preserves the price that
       * was used for the booking.
       */
      const pricePerNight = reservation.pricePerNight;

      const totalPrice = pricePerNight.mul(finalNights);

      /*
       * Update reservation.
       */
      const result = await tx.reservation.update({
        where: {
          id,
        },

        data: {
          status: "CHECKED_OUT",

          checkOutDate,

          totalPrice,
        },

        include: {
          room: true,
          guest: true,
        },
      });

      /*
       * After checkout, the room needs cleaning.
       */
      await tx.room.update({
        where: {
          id: reservation.roomId,
          hotelId: user.hotelId,
        },

        data: {
          status: "NEEDS_CLEANING",
        },
      });

      /*
       * Audit log.
       */
      await writeAuditLog(tx, {
        hotelId: user.hotelId,

        userId: user.userId,

        action: "RESERVATION_CHECKED_OUT",

        entityType: "reservation",

        metadata: {
          reservationId: id,

          roomId: reservation.roomId,

          guestId: reservation.guestId,

          checkInDate: checkInDateString,

          checkOutDate: todayString,

          nights: finalNights,

          totalPrice,
        },
      });

      return result;
    }, { timeout: 10000 });

    return Response.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
