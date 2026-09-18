import { prisma } from '../../../../../lib/db';
import { requireAuth } from '../../../../../lib/middleware/requireAuth';
import { createGuestSchema } from '../../../../../lib/validators/guest';
import { writeAuditLog } from '../../../../../lib/services/audit.service';
import { ApiError, handleRouteError } from '../../../../../lib/api/errors';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth({ roles: ['MANAGER', 'RECEPTIONIST'] });
    if (!user) throw new ApiError('Unauthorized', 401);

    const guest = await prisma.guest.findFirst({
      where: { id, hotelId: user.hotelId },
      include: {
        reservations: {
          include: { room: true },
          orderBy: { checkInDate: 'desc' },
        },
      },
    });
    if (!guest) throw new ApiError('Guest not found', 404);

    return Response.json(guest);
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
    const parsed = createGuestSchema.partial().safeParse(body);
    if (!parsed.success) throw new ApiError('Invalid request body', 400);

    const guest = await prisma.guest.findFirst({ where: { id, hotelId: user.hotelId } });
    if (!guest) throw new ApiError('Guest not found', 404);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.guest.update({ where: { id }, data: parsed.data });

      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: 'GUEST_UPDATED',
        entityType: 'guest',
        metadata: { guestId: id, changes: parsed.data },
      });

      return result;
    });

    return Response.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
