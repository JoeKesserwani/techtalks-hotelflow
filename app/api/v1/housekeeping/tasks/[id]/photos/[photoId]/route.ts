import { prisma } from '../../../../../../../../lib/db';
import { requireAuth } from '../../../../../../../../lib/middleware/requireAuth';
import { ApiError, handleRouteError } from '../../../../../../../../lib/api/errors';

export async function GET(
  req: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      photoId: string;
    }>;
  }
) {
  try {
    const { id, photoId } = await params;

    const user = await requireAuth({
      roles: [
        'ADMIN',
        'MANAGER',
        'RECEPTIONIST',
        'HOUSEKEEPING',
      ],
    });

    if (!user) {
      throw new ApiError(
        'Unauthorized',
        401
      );
    }

    const task =
      await prisma.housekeepingTask.findFirst({
        where: {
          id,
          hotelId: user.hotelId,
        },
        select: {
          id: true,
          assignedToUserId: true,
        },
      });

    if (!task) {
      throw new ApiError(
        'Task not found',
        404
      );
    }

    if (
      user.role === 'HOUSEKEEPING' &&
      task.assignedToUserId !== user.userId
    ) {
      throw new ApiError(
        'This task is not assigned to you',
        403
      );
    }

    const photo =
      await prisma.housekeepingTaskPhoto.findFirst({
        where: {
          id: photoId,
          taskId: id,
        },
        select: {
          fileName: true,
          mimeType: true,
          data: true,
        },
      });

    if (!photo) {
      throw new ApiError(
        'Photo not found',
        404
      );
    }

    return new Response(photo.data, {
      status: 200,
      headers: {
        'Content-Type': photo.mimeType,

        'Content-Disposition': `inline; filename="${encodeURIComponent(
          photo.fileName
        )}"`,

        'Cache-Control':
          'private, max-age=3600',
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}