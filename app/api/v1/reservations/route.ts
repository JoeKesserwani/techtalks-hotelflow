import { prisma } from '../../../../lib/db';
import { requireAuth } from '../../../../lib/middleware/requireAuth';
import { createReservationSchema } from '../../../../lib/validators/reservation';
import { writeAuditLog } from '../../../../lib/services/audit.service';
import { ApiError, handleRouteError } from '../../../../lib/api/errors';

export async function GET() {
  try {
    const user = await requireAuth({ roles: ['MANAGER', 'RECEPTIONIST'] });
    if (!user) throw new ApiError('Unauthorized', 401);

    const reservations = await prisma.reservation.findMany({
      where: { hotelId: user.hotelId },
      include: { room: true, guest: true },
      orderBy: { checkInDate: 'desc' },
    });

    return Response.json(reservations);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth({ roles: ['MANAGER', 'RECEPTIONIST'] });
    if (!user) throw new ApiError('Unauthorized', 401);

    const body = await req.json();
    const parsed = createReservationSchema.safeParse(body);
    if (!parsed.success) throw new ApiError('Invalid request body', 400);
    const { roomId, guestId, checkInDate, checkOutDate } = parsed.data;

    const reservation = await prisma.$transaction(async (tx) => {
      const room = await tx.room.findFirst({ where: { id: roomId, hotelId: user.hotelId } });
      if (!room) throw new ApiError('Room not found', 404);

      const guest = await tx.guest.findFirst({ where: { id: guestId, hotelId: user.hotelId } });
      if (!guest) throw new ApiError('Guest not found', 404);

      // Overlap check: any active reservation on this room whose date range intersects
      const overlap = await tx.reservation.findFirst({
        where: {
          roomId,
          status: { in: ['BOOKED', 'CHECKED_IN'] },
          checkInDate: { lt: checkOutDate },
          checkOutDate: { gt: checkInDate },
        },
      });
      if (overlap) throw new ApiError('Room is already booked for those dates', 409);

      const nights = Math.ceil(
        (new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      const pricePerNight = room.basePrice;
      const totalPrice = pricePerNight.mul(nights);

      const newReservation = await tx.reservation.create({
        data: {
          hotelId: user.hotelId,
          roomId,
          guestId,
          createdByUserId: user.userId,
          checkInDate,
          checkOutDate,
          pricePerNight,
          totalPrice,
          status: 'BOOKED',
        },
      });

      await tx.room.update({ where: { id: roomId }, data: { status: 'RESERVED' } });

      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: 'RESERVATION_CREATED',
        entityType: 'reservation',
        metadata: { reservationId: newReservation.id, roomId, checkInDate, checkOutDate },
      });

      return newReservation;
    });

    return Response.json(reservation, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
