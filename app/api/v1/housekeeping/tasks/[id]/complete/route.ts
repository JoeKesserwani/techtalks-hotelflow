import { prisma } from '../../../../../../../lib/db';
import { requireAuth } from '../../../../../../../lib/middleware/requireAuth';
import { writeAuditLog } from '../../../../../../../lib/services/audit.service';
import { completeHousekeepingTaskSchema } from '../../../../../../../lib/validators/housekeeping';
import { ApiError, handleRouteError } from '../../../../../../../lib/api/errors';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth({ roles: ['ADMIN', 'MANAGER','RECEPTIONIST', 'HOUSEKEEPING'] });
    if (!user) throw new ApiError('Unauthorized', 401);

    // Body is optional — completing without photos is still allowed.
    const body = await req.json().catch(() => ({}));
    const parsed = completeHousekeepingTaskSchema.safeParse(body);
    if (!parsed.success) throw new ApiError('Invalid request body', 400);

    const task = await prisma.housekeepingTask.findFirst({ where: { id, hotelId: user.hotelId } });
    if (!task) throw new ApiError('Task not found', 404);

    if (user.role === 'HOUSEKEEPING' && task.assignedToUserId !== user.userId) {
      throw new ApiError('This task is not assigned to you', 403);
    }

    if (task.status === 'DONE') return Response.json(task); // idempotent
    if (task.status !== 'IN_PROGRESS') {
      throw new ApiError(`Cannot complete a task with status ${task.status}`, 409);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.housekeepingTask.update({
        where: { id },
        data: {
          status: 'DONE',
          completedAt: new Date(),
          photos: parsed.data.photos ?? undefined,
        },
      });

      await tx.room.update({ where: { id: task.roomId }, data: { status: 'AVAILABLE' } });

      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: 'HOUSEKEEPING_TASK_COMPLETED',
        entityType: 'housekeeping_task',
        metadata: { taskId: id, roomId: task.roomId, photoCount: parsed.data.photos?.length ?? 0 },
      });

      return result;
    });

    return Response.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
