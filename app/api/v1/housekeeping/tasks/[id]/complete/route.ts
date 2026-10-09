import { prisma } from '../../../../../../../lib/db';
import { requireAuth } from '../../../../../../../lib/middleware/requireAuth';
import { writeAuditLog } from '../../../../../../../lib/services/audit.service';
import { ApiError, handleRouteError } from '../../../../../../../lib/api/errors';

const MAX_PHOTOS = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per image

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await requireAuth({
      roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING'],
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

    if (
      user.role === 'HOUSEKEEPING' &&
      task.assignedToUserId !== user.userId
    ) {
      throw new ApiError('This task is not assigned to you', 403);
    }

    if (task.status === 'DONE') {
      return Response.json(task);
    }

    if (task.status !== 'IN_PROGRESS') {
      throw new ApiError(
        `Cannot complete a task with status ${task.status}`,
        409
      );
    }

    const formData = await req.formData();

    const photoEntries = formData.getAll('photos');

    const photos = photoEntries.filter(
      (entry): entry is File => entry instanceof File
    );

    if (photos.length > MAX_PHOTOS) {
      throw new ApiError(
        `You can upload a maximum of ${MAX_PHOTOS} photos`,
        400
      );
    }

    for (const photo of photos) {
      if (!photo.type.startsWith('image/')) {
        throw new ApiError(
          'Only image files are allowed',
          400
        );
      }

      if (photo.size > MAX_FILE_SIZE) {
        throw new ApiError(
          'Each image must be 10 MB or smaller',
          400
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.housekeepingTask.update({
        where: { id },
        data: {
          status: 'IN_REVIEW',
          completedAt: new Date(),
        },
      });

      for (const photo of photos) {
        const arrayBuffer = await photo.arrayBuffer();

        await tx.housekeepingTaskPhoto.create({
          data: {
            taskId: id,
            fileName: photo.name,
            mimeType: photo.type,
            data: Buffer.from(arrayBuffer),
          },
        });
      }

      await tx.room.update({
        where: { id: task.roomId },
        data: {
          status: 'AVAILABLE',
        },
      });

      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: 'HOUSEKEEPING_TASK_COMPLETED',
        entityType: 'housekeeping_task',
        metadata: {
          taskId: id,
          roomId: task.roomId,
          photoCount: photos.length,
        },
      });

      return result;
    });

    return Response.json({
      ...updated,
      photoCount: photos.length,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}