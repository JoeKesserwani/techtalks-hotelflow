import { prisma } from '../../../../../../../lib/db';
import { requireAuth } from '../../../../../../../lib/middleware/requireAuth';
import { writeAuditLog } from '../../../../../../../lib/services/audit.service';
import { ApiError, handleRouteError } from '../../../../../../../lib/api/errors';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth({ roles: ['MANAGER', 'HOUSEKEEPING'] });
    if (!user) throw new ApiError('Unauthorized', 401);

    const task = await prisma.housekeepingTask.findFirst({ where: { id, hotelId: user.hotelId } });
    if (!task) throw new ApiError('Task not found', 404);

    // Housekeeping can only start a task assigned to them; manager can start any.
    if (user.role === 'HOUSEKEEPING' && task.assignedToUserId !== user.userId) {
      throw new ApiError('This task is not assigned to you', 403);
    }

    if (task.status === 'IN_PROGRESS') return Response.json(task); // idempotent
    if (task.status !== 'PENDING') {
      throw new ApiError(`Cannot start a task with status ${task.status}`, 409);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.housekeepingTask.update({
        where: { id },
        data: { status: 'IN_PROGRESS', startedAt: new Date() },
      });

      await tx.room.update({ where: { id: task.roomId }, data: { status: 'CLEANING' } });

      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: 'HOUSEKEEPING_TASK_STARTED',
        entityType: 'housekeeping_task',
        metadata: { taskId: id, roomId: task.roomId },
      });

      return result;
    });

    return Response.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
