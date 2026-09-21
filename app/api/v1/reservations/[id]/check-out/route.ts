import { prisma } from "../../../../../../lib/db";
import { requireAuth } from "../../../../../../lib/middleware/requireAuth";
import { writeAuditLog } from "../../../../../../lib/services/audit.service";
import {
  ApiError,
  handleRouteError,
} from "../../../../../../lib/api/errors";

function getStartOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function calculateNights(checkInDate: Date, checkOutDate: Date) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  return Math.max(
    0,
    Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) /
        millisecondsPerDay
    )
  );
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth({
      roles: ["MANAGER", "RECEPTIONIST"],
    });

    if (!user) {
      throw new ApiError("Unauthorized", 401);
    }

    const { id } = await params;

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

    // Already checked out
    if (reservation.status === "CHECKED_OUT") {
      return Response.json(reservation);
    }

    // Only a checked-in reservation can be checked out
    if (reservation.status !== "CHECKED_IN") {
      throw new ApiError(
        "Only guests who are currently checked in can check out",
        400
      );
    }

    const today = getStartOfToday();

    const checkInDate = new Date(reservation.checkInDate);
    checkInDate.setHours(0, 0, 0, 0);

    // Cannot check out before the check-in date.
    // Same-day check-in/check-out is allowed.
    if (today.getTime() < checkInDate.getTime()) {
      throw new ApiError(
        "Check-out date cannot be before the check-in date",
        400
      );
    }

    const nights = calculateNights(checkInDate, today);

    const updatedReservation = await prisma.$transaction(async (tx) => {
      const room = await tx.room.findFirst({
        where: {
          id: reservation.roomId,
          hotelId: user.hotelId,
        },
      });

      if (!room) {
        throw new ApiError("Room not found", 404);
      }

      // Price always comes from the reservation's room price.
      const totalPrice = reservation.pricePerNight.mul(nights);

      const updated = await tx.reservation.update({
        where: {
          id: reservation.id,
        },
        data: {
          status: "CHECKED_OUT",
          checkOutDate: today,
          totalPrice,
        },
        include: {
          room: true,
          guest: true,
        },
      });

      // After checkout, the room needs cleaning.
      await tx.room.update({
        where: {
          id: reservation.roomId,
        },
        data: {
          status: "NEEDS_CLEANING",
        },
      });

      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: "RESERVATION_CHECKED_OUT",
        entityType: "reservation",
        metadata: {
          reservationId: reservation.id,
          roomId: reservation.roomId,
          guestId: reservation.guestId,
          actualCheckOutDate: today,
          nights,
          totalPrice: totalPrice.toString(),
        },
      });

      return updated;
    });

    return Response.json(updatedReservation);
  } catch (err) {
    return handleRouteError(err);
  }
}