import { prisma } from '../../../../../../lib/db';
import { requireAuth } from '../../../../../../lib/middleware/requireAuth';
import { updateHousekeepingTaskSchema } from '../../../../../../lib/validators/housekeeping';
import { writeAuditLog } from '../../../../../../lib/services/audit.service';
import { ApiError, handleRouteError } from '../../../../../../lib/api/errors';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth({ roles: ['MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING'] });
    if (!user) throw new ApiError('Unauthorized', 401);

    const task = await prisma.housekeepingTask.findFirst({
      where: { id, hotelId: user.hotelId },
      include: { room: true },
    });
    if (!task) throw new ApiError('Task not found', 404);

    if (user.role === 'HOUSEKEEPING' && task.assignedToUserId !== user.userId) {
      throw new ApiError('This task is not assigned to you', 403);
    }

    return Response.json(task);
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
    const parsed = updateHousekeepingTaskSchema.safeParse(body);
    if (!parsed.success) throw new ApiError('Invalid request body', 400);

    const task = await prisma.housekeepingTask.findFirst({ where: { id, hotelId: user.hotelId } });
    if (!task) throw new ApiError('Task not found', 404);

    if (task.status !== 'PENDING') {
      throw new ApiError('Cannot reassign a task that already started', 409);
    }

    if (parsed.data.assignedToUserId) {
      const assignee = await prisma.user.findFirst({
        where: {
          id: parsed.data.assignedToUserId,
          hotelId: user.hotelId,
          role: 'HOUSEKEEPING',
          isActive: true,
        },
      });
      if (!assignee) {
        throw new ApiError('New assignee must be an active HOUSEKEEPING staff member', 400);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.housekeepingTask.update({ where: { id }, data: parsed.data });

      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: 'HOUSEKEEPING_TASK_REASSIGNED',
        entityType: 'housekeeping_task',
        metadata: { taskId: id, changes: parsed.data },
      });

      return result;
    });

    return Response.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
