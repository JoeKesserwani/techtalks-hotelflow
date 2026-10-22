import { prisma } from '../../../../../lib/db';
import { requireAuth } from '../../../../../lib/middleware/requireAuth';
import { updateRoomStatusSchema, updateRoomSchema } from '../../../../../lib/validators/room';
import { writeAuditLog } from '../../../../../lib/services/audit.service';
import { ApiError, handleRouteError } from '../../../../../lib/api/errors';


export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await requireAuth({
      roles: ["ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING"],
    });

    if (!user) {
      throw new ApiError("Unauthorized", 401);
    }

    const room = await prisma.room.findFirst({
      where: {
        id,
        hotelId: user.hotelId,
      },
      include: {
        reservations: {
          where: {
            status: "CHECKED_IN",
          },
          include: {
            guest: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
          orderBy: {
            checkInDate: "desc",
          },
          take: 1,
        },
        housekeepingTasks: {
          where: {
            status: {
              in: ["PENDING", "IN_PROGRESS", "IN_REVIEW"],
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            id: true,
            status: true,
            assignedToUserId: true,
            assignedTo: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      throw new ApiError("Room not found", 404);
    }

    const currentReservation = room.reservations[0] ?? null;
    const activeHousekeepingTask = room.housekeepingTasks[0] ?? null;

    const {
      reservations,
      housekeepingTasks,
      ...roomDetails
    } = room;

    return Response.json({
      ...roomDetails,
      currentGuest: currentReservation?.guest ?? null,
      currentReservation: currentReservation
        ? {
            id: currentReservation.id,
            checkInDate: currentReservation.checkInDate,
            checkOutDate: currentReservation.checkOutDate,
            status: currentReservation.status,
          }
        : null,
      activeHousekeepingTask,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}


export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Manager can edit anything (number, type, price, status); housekeeping can only touch status.
    const user = await requireAuth({ roles: ['ADMIN','MANAGER', 'HOUSEKEEPING', 'RECEPTIONIST'] });
    if (!user) throw new ApiError('Unauthorized', 401);

    const body = await req.json();

    const room = await prisma.room.findFirst({ where: { id, hotelId: user.hotelId } });
    if (!room) throw new ApiError('Room not found', 404);

    let data: Record<string, unknown>;

    if (user.role === 'HOUSEKEEPING') {
      const parsed = updateRoomStatusSchema.safeParse(body);
      if (!parsed.success) throw new ApiError('Housekeeping may only update status', 400);
      data = parsed.data;
    } else {
      const parsed = updateRoomSchema.safeParse(body);
      if (!parsed.success) throw new ApiError('Invalid request body', 400);
      data = parsed.data;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.room.update({ where: { id }, data });

      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: 'ROOM_UPDATED',
        entityType: 'room',
        metadata: { roomId: id, changes: data },
      });

      return result;
    });

    return Response.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
