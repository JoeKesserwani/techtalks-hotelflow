import { prisma } from '../../../../../../lib/db';
import { requireAuth } from '../../../../../../lib/middleware/requireAuth';
import { writeAuditLog } from '../../../../../../lib/services/audit.service';
import { ApiError, handleRouteError } from '../../../../../../lib/api/errors';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth({ roles: ['MANAGER', 'RECEPTIONIST'] });
    if (!user) throw new ApiError('Unauthorized', 401);

    const reservation = await prisma.reservation.findFirst({
      where: { id, hotelId: user.hotelId },
    });
    if (!reservation) throw new ApiError('Reservation not found', 404);

    if (reservation.status === 'CHECKED_OUT') {
      return Response.json(reservation); // idempotent
    }
    if (reservation.status !== 'CHECKED_IN') {
      throw new ApiError(`Cannot check out a reservation with status ${reservation.status}`, 409);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.reservation.update({
        where: { id },
        data: { status: 'CHECKED_OUT' },
      });

      // Room becomes NEEDS_CLEANING — no housekeeping_tasks row is created here.
      // A receptionist creates and assigns the cleaning task manually via
      // POST /api/v1/housekeeping/tasks.
      await tx.room.update({ where: { id: reservation.roomId }, data: { status: 'NEEDS_CLEANING' } });

      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: 'RESERVATION_CHECKED_OUT',
        entityType: 'reservation',
        metadata: { reservationId: id, roomId: reservation.roomId },
      });

      return result;
    });

    return Response.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
