import { prisma } from "../../../../../../lib/db";
import { requireAuth } from "../../../../../../lib/middleware/requireAuth";
import { writeAuditLog } from "../../../../../../lib/services/audit.service";
import { ApiError, handleRouteError } from "../../../../../../lib/api/errors";

/*
 * PATCH /api/v1/reservations/:id/payment   body: { "paymentStatus": "PAID" }
 *
 * Why a dedicated route: PATCH /reservations/:id re-validates "check-in cannot be
 * before today" and recalculates the price, so it rejects payments for guests who are
 * already in-house. Recording a payment must work at any point of the stay and must
 * never touch dates or prices.
 *
 * Adjust ALLOWED to match your Prisma PaymentStatus enum.
 */
const ALLOWED = ["UNPAID", "PARTIAL", "PAID"] as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const user = await requireAuth({
      roles: ["ADMIN", "MANAGER", "RECEPTIONIST"],
    });
    if (!user) throw new ApiError("Unauthorized", 401);

    const body = await req.json().catch(() => null);
    const paymentStatus = body?.paymentStatus;
    if (!ALLOWED.includes(paymentStatus)) {
      throw new ApiError("Invalid payment status", 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findFirst({
        where: { id, hotelId: user.hotelId },
      });
      if (!reservation) throw new ApiError("Reservation not found", 404);

      const result = await tx.reservation.update({
        where: { id },
        data: { paymentStatus },
        include: { room: true, guest: true },
      });

      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: "RESERVATION_UPDATED",
        entityType: "reservation",
        metadata: {
          reservationId: id,
          changes: {
            paymentStatus,
            previousPaymentStatus: reservation.paymentStatus,
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
