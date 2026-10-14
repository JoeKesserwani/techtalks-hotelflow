import { prisma } from "../../../../../../lib/db";
import { requireAuth } from "../../../../../../lib/middleware/requireAuth";
import { writeAuditLog } from "../../../../../../lib/services/audit.service";
import { ApiError, handleRouteError } from "../../../../../../lib/api/errors";

/*
 * POST /api/v1/reservations/:id/cancel   body: { reason?: string }
 *
 * Cancels a reservation that has NOT checked in yet.
 *
 * Why not the existing DELETE /reservations/:id:
 *  - it has no status guard, so a client could delete a CHECKED_IN or CHECKED_OUT record;
 *  - it flips the room to AVAILABLE when no other active reservation exists, which skips
 *    cleaning for a room that is physically NEEDS_CLEANING / CLEANING / IN_REVIEW.
 *    A BOOKED reservation never changes room.status (see creation), so cancelling one must not either.
 *
 * The row is removed (same behaviour as the existing DELETE) and a full snapshot goes to the
 * audit log. If you would rather keep cancelled bookings for reporting, add CANCELLED to the
 * ReservationStatus enum and replace the delete with an update; the client already ignores
 * CANCELLED reservations.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const user = await requireAuth({
      roles: ["ADMIN", "MANAGER", "RECEPTIONIST"],
    });
    if (!user) throw new ApiError("Unauthorized", 401);

    const body = await req.json().catch(() => ({}));
    const reason =
      typeof body?.reason === "string" && body.reason.trim()
        ? body.reason.trim().slice(0, 200)
        : null;

    await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findFirst({
        where: { id, hotelId: user.hotelId },
        include: {
          room: { select: { roomNumber: true } },
          guest: { select: { fullName: true } },
        },
      });
      if (!reservation) throw new ApiError("Reservation not found", 404);

      if (reservation.status !== "BOOKED") {
        throw new ApiError(
          "Only reservations that have not checked in can be cancelled",
          400,
        );
      }

      await tx.reservation.delete({ where: { id } });

      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: "RESERVATION_DELETED",
        entityType: "reservation",
        metadata: {
          reservationId: id,
          cancelled: true,
          reason,
          roomId: reservation.roomId,
          roomNumber: reservation.room.roomNumber,
          guestId: reservation.guestId,
          guestName: reservation.guest.fullName,
          previousStatus: reservation.status,
          checkInDate: reservation.checkInDate.toISOString().slice(0, 10),
          checkOutDate: reservation.checkOutDate.toISOString().slice(0, 10),
          totalPrice: reservation.totalPrice.toString(),
          paymentStatus: reservation.paymentStatus,
        },
      });
    });

    return Response.json({ id, message: "Reservation cancelled" });
  } catch (err) {
    return handleRouteError(err);
  }
}
