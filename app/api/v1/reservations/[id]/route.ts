import { prisma } from '../../../../../lib/db';
import { requireAuth } from '../../../../../lib/middleware/requireAuth';
import { updateReservationSchema } from '../../../../../lib/validators/reservation';
import { writeAuditLog } from '../../../../../lib/services/audit.service';
import { ApiError, handleRouteError } from '../../../../../lib/api/errors';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth({ roles: ['MANAGER', 'RECEPTIONIST'] });
    if (!user) throw new ApiError('Unauthorized', 401);

    const reservation = await prisma.reservation.findFirst({
      where: { id, hotelId: user.hotelId },
      include: { room: true, guest: true },
    });
    if (!reservation) throw new ApiError('Reservation not found', 404);

    return Response.json(reservation);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth({ roles: ['MANAGER', 'RECEPTIONIST'] });
    if (!user) throw new ApiError('Unauthorized', 401);

    const body = await req.json();
    const parsed = updateReservationSchema.safeParse(body);
    if (!parsed.success) throw new ApiError('Invalid request body', 400);

    const reservation = await prisma.reservation.findFirst({
      where: { id, hotelId: user.hotelId },
    });
    if (!reservation) throw new ApiError('Reservation not found', 404);

    if (['CHECKED_OUT', 'CANCELLED', 'NO_SHOW'].includes(reservation.status)) {
      throw new ApiError(`Cannot edit a reservation with status ${reservation.status}`, 409);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.reservation.update({ where: { id }, data: parsed.data });

      if (parsed.data.status === 'CANCELLED' || parsed.data.status === 'NO_SHOW') {
        await tx.room.update({ where: { id: reservation.roomId }, data: { status: 'AVAILABLE' } });
      }

      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: 'RESERVATION_UPDATED',
        entityType: 'reservation',
        metadata: { reservationId: id, changes: parsed.data },
      });

      return result;
    });

    return Response.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
