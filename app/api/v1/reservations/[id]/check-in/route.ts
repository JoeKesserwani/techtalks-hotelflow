import { prisma } from "../../../../../../lib/db";
import { requireAuth } from "../../../../../../lib/middleware/requireAuth";
import { writeAuditLog } from "../../../../../../lib/services/audit.service";
import {
  ApiError,
  handleRouteError,
} from "../../../../../../lib/api/errors";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth({
      roles: ["ADMIN","MANAGER", "RECEPTIONIST"],
    });

    if (!user) {
      throw new ApiError("Unauthorized", 401);
    }

    const { id } = await params;

    // Find the reservation and make sure it belongs
    // to the logged-in user's hotel.
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

    // If already checked in, simply return it.
    if (reservation.status === "CHECKED_IN") {
      return Response.json(reservation);
    }

    // Only an Upcoming/BOOKED reservation can be checked in.
    if (reservation.status !== "BOOKED") {
      throw new ApiError(
        "Only upcoming reservations can be checked in",
        400
      );
    }

    const updatedReservation = await prisma.$transaction(
      async (tx) => {
        // Get the room again inside the transaction.
        const room = await tx.room.findFirst({
          where: {
            id: reservation.roomId,
            hotelId: user.hotelId,
          },
        });

        if (!room) {
          throw new ApiError("Room not found", 404);
        }

        // These room states cannot be checked in.
        const unavailableStatuses = [
          "OCCUPIED",
          "NEEDS_CLEANING",
          "CLEANING",
          "OUT_OF_SERVICE",
        ] as const;

        if (
          unavailableStatuses.includes(
            room.status as (typeof unavailableStatuses)[number]
          )
        ) {
          throw new ApiError(
            "This room is not available for check-in",
            409
          );
        }

        // Change reservation:
        // BOOKED -> CHECKED_IN
        const updated = await tx.reservation.update({
          where: {
            id: reservation.id,
          },
          data: {
            status: "CHECKED_IN",
          },
          include: {
            room: true,
            guest: true,
          },
        });

        // Change room:
        // RESERVED/AVAILABLE -> OCCUPIED
        await tx.room.update({
          where: {
            id: reservation.roomId,
          },
          data: {
            status: "OCCUPIED",
          },
        });

        // Record the action.
        await writeAuditLog(tx, {
          hotelId: user.hotelId,
          userId: user.userId,
          action: "RESERVATION_CHECKED_IN",
          entityType: "reservation",
          metadata: {
            reservationId: reservation.id,
            roomId: reservation.roomId,
            guestId: reservation.guestId,
          },
        });

        return updated;
      }
    );

    return Response.json(updatedReservation);
  } catch (err) {
    return handleRouteError(err);
  }
}