import { prisma } from '../../../../../lib/db';
import { requireAuth } from '../../../../../lib/middleware/requireAuth';
import {
  ApiError,
  handleRouteError,
} from '../../../../../lib/api/errors';

export async function GET() {
  try {
    const user = await requireAuth({
      roles: ['HOUSEKEEPING'],
    });

    if (!user) {
      throw new ApiError('Unauthorized', 401);
    }

    /* ---------------------------------------------
       Get housekeeping tasks
    --------------------------------------------- */

    const baseWhere = {
      hotelId: user.hotelId,
      assignedToUserId: user.userId,
    };

    const tasks = await prisma.housekeepingTask.findMany({
      where: {
        ...baseWhere,
        status: {
          in: ['DONE', 'IN_REVIEW', 'PENDING'],
        },
      },

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

        assignedTo: {
          select: {
            fullName: true,
          },
        },
      },

      orderBy: [
        { completedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    /* ---------------------------------------------
       Get review audit logs
    --------------------------------------------- */

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        hotelId: user.hotelId,
        entityType: 'housekeeping_task',
        action: {
          in: [
            'HOUSEKEEPING_TASK_APPROVED',
            'HOUSEKEEPING_TASK_REJECTED',
          ],
        },
      },

      select: {
        action: true,
        createdAt: true,
        metadataJson: true,

        user: {
          select: {
            fullName: true,
          },
        },
      },

      orderBy: {
        createdAt: 'asc',
      },
    });

    /* ---------------------------------------------
       Group review history by task
    --------------------------------------------- */

    type Review = {
      action: 'APPROVED' | 'REJECTED';
      reviewedBy: string;
      reviewedAt: Date;
      reviewNote: string;
    };

    const reviewsByTask = new Map<string, Review[]>();

    for (const log of auditLogs) {
      const metadata = log.metadataJson;

      if (
        !metadata ||
        typeof metadata !== 'object' ||
        Array.isArray(metadata)
      ) {
        continue;
      }

      const { taskId, comment } = metadata as {
        taskId?: string;
        comment?: string;
      };

      if (!taskId) {
        continue;
      }

      const review: Review = {
        action:
          log.action === 'HOUSEKEEPING_TASK_APPROVED'
            ? 'APPROVED'
            : 'REJECTED',

        reviewedBy: log.user?.fullName ?? '—',
        reviewedAt: log.createdAt,
        reviewNote: comment ?? '',
      };

      const reviews = reviewsByTask.get(taskId) ?? [];
      reviews.push(review);
      reviewsByTask.set(taskId, reviews);
    }

    /* ---------------------------------------------
       Build history
    --------------------------------------------- */

    const history = tasks
      .map((task) => {
        const reviewHistory =
          reviewsByTask.get(task.id) ?? [];

        const latestReview =
          reviewHistory.at(-1) ?? null;

        let historyStatus:
          | 'AWAITING_APPROVAL'
          | 'COMPLETED'
          | 'REJECTED';

        if (task.status === 'IN_REVIEW') {
          historyStatus = 'AWAITING_APPROVAL';
        } else if (task.status === 'DONE') {
          historyStatus = 'COMPLETED';
        } else if (
          task.status === 'PENDING' &&
          latestReview?.action === 'REJECTED'
        ) {
          historyStatus = 'REJECTED';
        } else {
          return null;
        }

        return {
          ...task,
          historyStatus,
          reviewHistory,
        };
      })
      .filter(
        (
          task
        ): task is NonNullable<typeof task> =>
          task !== null
      );

    /* ---------------------------------------------
       Sort newest activity first
    --------------------------------------------- */

    history.sort((a, b) => {
      const getHistoryDate = (
        task: (typeof history)[number]
      ) => {
        if (task.historyStatus === 'REJECTED') {
          const latestRejection = [...task.reviewHistory]
            .reverse()
            .find(
              (review) => review.action === 'REJECTED'
            );

          if (latestRejection) {
            return new Date(
              latestRejection.reviewedAt
            ).getTime();
          }
        }

        if (task.completedAt) {
          return new Date(task.completedAt).getTime();
        }

        return new Date(task.createdAt).getTime();
      };

      return (
        getHistoryDate(b) -
        getHistoryDate(a)
      );
    });

    return Response.json(history);
  } catch (err) {
    return handleRouteError(err);
  }
}
