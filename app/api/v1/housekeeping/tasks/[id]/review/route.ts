import { z } from 'zod';
import { Prisma } from '../../../../../../../app/generated/prisma/client';
import { prisma } from '../../../../../../../lib/db';
import { requireAuth } from '../../../../../../../lib/middleware/requireAuth';
import { writeAuditLog } from '../../../../../../../lib/services/audit.service';
import { ApiError, handleRouteError } from '../../../../../../../lib/api/errors';
import { createNotification } from '@/lib/notifications';

const reviewHousekeepingTaskSchema = z.object({
  action: z.enum(['approve', 'reject']),
  comment: z.string().max(500).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth({ roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'] });
    if (!user) throw new ApiError('Unauthorized', 401);

    const body = await req.json();
    const parsed = reviewHousekeepingTaskSchema.safeParse(body);
    if (!parsed.success) throw new ApiError('Invalid request body', 400);

    const task = await prisma.housekeepingTask.findFirst({
      where: { id, hotelId: user.hotelId },
    });
    if (!task) throw new ApiError('Task not found', 404);

    if (task.status !== 'IN_REVIEW') {
      throw new ApiError('Only tasks awaiting review can be reviewed', 409);
    }

    const room = await prisma.room.findFirst({
      where: { id: task.roomId, hotelId: user.hotelId },
      select: { roomNumber: true },
    });

    const isApproved = parsed.data.action === 'approve';
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.housekeepingTask.update({
        where: { id },
        data: {
          status: isApproved ? 'DONE' : 'PENDING',
          completedAt: isApproved ? task.completedAt : null,
          startedAt: isApproved ? task.startedAt : null,
          photos: isApproved ? undefined : Prisma.JsonNull,
          notes: parsed.data.comment?.trim() || undefined,
        },
      });

      if (!isApproved) {
        await tx.room.update({
          where: { id: task.roomId },
          data: { status: 'NEEDS_CLEANING' },
        });
      } else {
        const activeStay = await tx.reservation.findFirst({
          where: {
            roomId: task.roomId,
            status: 'CHECKED_IN',
            checkInDate: { lte: new Date() },
            checkOutDate: { gte: new Date() },
          },
        });

        await tx.room.update({
          where: { id: task.roomId },
          data: { status: activeStay ? 'OCCUPIED' : 'AVAILABLE' },
        });
      }

      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: isApproved ? 'HOUSEKEEPING_TASK_APPROVED' : 'HOUSEKEEPING_TASK_REJECTED',
        entityType: 'housekeeping_task',
        metadata: { taskId: id, roomId: task.roomId, comment: parsed.data.comment ?? null },
      });

      const comment = parsed.data.comment?.trim();
      await createNotification(
        {
          hotelId: task.hotelId,
          userId: task.assignedToUserId,
          title: isApproved ? 'Cleaning task approved' : 'Cleaning task rejected',
          message: isApproved
            ? `Your cleaning task for Room ${room?.roomNumber ?? task.roomId} has been approved.`
            : `Your cleaning task for Room ${room?.roomNumber ?? task.roomId} was rejected.`,
          type: isApproved ? 'TASK_APPROVED' : 'TASK_REJECTED',
          taskId: task.id,
        },
        tx,
      );

      return result;
    });

    return Response.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
