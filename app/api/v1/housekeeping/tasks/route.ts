import { prisma } from '../../../../../lib/db';
import { requireAuth } from '../../../../../lib/middleware/requireAuth';
import { createHousekeepingTaskSchema } from '../../../../../lib/validators/housekeeping';
import { writeAuditLog } from '../../../../../lib/services/audit.service';
import { ApiError, handleRouteError } from '../../../../../lib/api/errors';
import { createNotification } from '@/lib/notifications';

export async function GET() {
  try {
    const user = await requireAuth({ roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING'] });
    if (!user) throw new ApiError('Unauthorized', 401);

    // Housekeeping only ever sees tasks assigned to them; manager/receptionist see all.
    const where =
      user.role === 'HOUSEKEEPING'
        ? { hotelId: user.hotelId, assignedToUserId: user.userId }
        : { hotelId: user.hotelId };

    const tasks = await prisma.housekeepingTask.findMany({
      where,
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        notes: true,
        photos: true,
        createdAt: true,
        room: {
          select: {
            roomNumber: true,
            roomType: true,
          },
        },
        assignedTo: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Response.json(tasks);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    // Only receptionist/manager create and assign tasks — housekeeping cannot self-assign.
    const user = await requireAuth({ roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'] });
    if (!user) throw new ApiError('Unauthorized', 401);

    const body = await req.json();
    const parsed = createHousekeepingTaskSchema.safeParse(body);
    if (!parsed.success) throw new ApiError('Invalid request body', 400);
    const { roomId, assignedToUserId, notes } = parsed.data;

    const room = await prisma.room.findFirst({ where: { id: roomId, hotelId: user.hotelId } });
    if (!room) throw new ApiError('Room not found', 404);

    const assignee = await prisma.user.findFirst({
      where: { id: assignedToUserId, hotelId: user.hotelId, role: 'HOUSEKEEPING', isActive: true },
    });
    if (!assignee) {
      throw new ApiError('assignedToUserId must be an active HOUSEKEEPING staff member in this hotel', 400);
    }

    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.housekeepingTask.create({
        data: {
          hotelId: user.hotelId,
          roomId,
          assignedToUserId,
          notes,
          status: 'PENDING',
        },
      });
      await createNotification({
        hotelId: user.hotelId,
        userId: assignedToUserId,
        title: "New housekeeping task",
        message: `You have been assigned to clean Room ${room.roomNumber}.`,
        type: "TASK_ASSIGNED",
        taskId: created.id,
      }, tx);
      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: 'HOUSEKEEPING_TASK_CREATED',
        entityType: 'housekeeping_task',
        metadata: { taskId: created.id, roomId, assignedToUserId },
      });
        
      return created;
    });
    
    return Response.json(task, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
