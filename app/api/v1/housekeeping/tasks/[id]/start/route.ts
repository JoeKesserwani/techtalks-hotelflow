import { prisma } from '../../../../../../../lib/db';
import { requireAuth } from '../../../../../../../lib/middleware/requireAuth';
import { writeAuditLog } from '../../../../../../../lib/services/audit.service';
import { ApiError, handleRouteError } from '../../../../../../../lib/api/errors';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const user = await requireAuth({
      roles: ['ADMIN', 'MANAGER', 'HOUSEKEEPING'],
    });

    if (!user) {
      throw new ApiError('Unauthorized', 401);
    }

    const task = await prisma.housekeepingTask.findFirst({
      where: {
        id,
        hotelId: user.hotelId,
      },
    });

    if (!task) {
      throw new ApiError('Task not found', 404);
    }

    // Housekeepers can only start tasks assigned to them.
    // Managers and admins retain their existing permissions.
    if (
      user.role === 'HOUSEKEEPING' &&
      task.assignedToUserId !== user.userId
    ) {
      throw new ApiError('This task is not assigned to you', 403);
    }

    // Repeated requests for a task that has already started are safe.
    if (task.status === 'IN_PROGRESS') {
      return Response.json(task);
    }

    if (task.status !== 'PENDING') {
      throw new ApiError(
        `Cannot start a task with status ${task.status}`,
        409,
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      if (user.role === 'HOUSEKEEPING') {
        // Lock this housekeeper's user row so two simultaneous start requests
        // for different tasks cannot both pass the active-task check.
        const lockedUsers = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM users
          WHERE id = ${user.userId}
            AND hotel_id = ${user.hotelId}
          FOR UPDATE
        `;

        if (lockedUsers.length === 0) {
          throw new ApiError('Housekeeping user not found', 404);
        }
      }

      // Re-read inside the transaction in case the task changed after the first lookup.
      const currentTask = await tx.housekeepingTask.findFirst({
        where: {
          id,
          hotelId: user.hotelId,
          ...(user.role === 'HOUSEKEEPING'
            ? { assignedToUserId: user.userId }
            : {}),
        },
      });

      if (!currentTask) {
        throw new ApiError('Task not found or no longer assigned to you', 404);
      }

      // Another request may have started this same task while we were waiting for the lock.
      if (currentTask.status === 'IN_PROGRESS') {
        return currentTask;
      }

      if (currentTask.status !== 'PENDING') {
        throw new ApiError(
          `Cannot start a task with status ${currentTask.status}`,
          409,
        );
      }

      // Enforce one active cleaning task per housekeeper.
      if (user.role === 'HOUSEKEEPING') {
        const activeTask = await tx.housekeepingTask.findFirst({
          where: {
            hotelId: user.hotelId,
            assignedToUserId: user.userId,
            status: 'IN_PROGRESS',
          },
          select: {
            id: true,
          },
        });

        if (activeTask) {
          throw new ApiError(
            'You already have a cleaning task in progress. Complete it before starting another.',
            409,
          );
        }
      }

      const updated = await tx.housekeepingTask.update({
        where: {
          id: currentTask.id,
        },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        },
      });

      await tx.room.update({
        where: {
          id: currentTask.roomId,
        },
        data: {
          status: 'CLEANING',
        },
      });

      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: 'HOUSEKEEPING_TASK_STARTED',
        entityType: 'housekeeping_task',
        metadata: {
          taskId: id,
          roomId: currentTask.roomId,
        },
      });

      return updated;
    });

    return Response.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
