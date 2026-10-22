import { prisma } from '../../../../../lib/db';
import { requireAuth } from '../../../../../lib/middleware/requireAuth';
import { createHousekeepingTaskSchema } from '../../../../../lib/validators/housekeeping';
import { writeAuditLog } from '../../../../../lib/services/audit.service';
import { ApiError, handleRouteError } from '../../../../../lib/api/errors';
import { createNotification, sendNotificationPush } from '@/lib/notifications';

export async function GET() {
  try {
    const user = await requireAuth({
      roles: [
        'ADMIN',
        'MANAGER',
        'RECEPTIONIST',
        'HOUSEKEEPING',
      ],
    });

    if (!user) {
      throw new ApiError('Unauthorized', 401);
    }

    const where =
      user.role === 'HOUSEKEEPING'
        ? {
            hotelId: user.hotelId,
            assignedToUserId: user.userId,
          }
        : {
            hotelId: user.hotelId,
          };

    const tasks = await prisma.housekeepingTask.findMany({
      where,

      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        notes: true,

        // Old photo data is preserved.
        photos: true,

        createdAt: true,

        // New database-stored photos.
        // Only metadata is returned here.
        photoFiles: {
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },

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

      orderBy: {
        createdAt: 'desc',
      },
    });

    return Response.json(tasks);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth({
      roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
    });

    if (!user) {
      throw new ApiError('Unauthorized', 401);
    }

    const body = await req.json();

    const parsed =
      createHousekeepingTaskSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        'Invalid request body',
        400
      );
    }

    const {
      roomId,
      assignedToUserId,
      notes,
    } = parsed.data;

    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        hotelId: user.hotelId,
      },
    });

    if (!room) {
      throw new ApiError(
        'Room not found',
        404
      );
    }

    const assignee = await prisma.user.findFirst({
      where: {
        id: assignedToUserId,
        hotelId: user.hotelId,
        role: 'HOUSEKEEPING',
        isActive: true,
      },
    });

    if (!assignee) {
      throw new ApiError(
        'assignedToUserId must be an active HOUSEKEEPING staff member in this hotel',
        400
      );
    }

    const notification = {
      hotelId: user.hotelId,
      userId: assignedToUserId,
      title: 'New housekeeping task',
      message: `You have been assigned to clean Room ${room.roomNumber}.`,
      type: 'TASK_ASSIGNED' as const,
    };
    const task = await prisma.$transaction(
      async (tx) => {
        const created =
          await tx.housekeepingTask.create({
            data: {
              hotelId: user.hotelId,
              roomId,
              assignedToUserId,
              notes,
              status: 'PENDING',
            },
          });

        await createNotification({ ...notification, taskId: created.id }, tx);
        await writeAuditLog(tx, {
          hotelId: user.hotelId,
          userId: user.userId,
          action: 'HOUSEKEEPING_TASK_CREATED',
          entityType: 'housekeeping_task',
          metadata: { taskId: created.id, roomId, assignedToUserId },
        });

        return created;
      }
    );

    await sendNotificationPush(notification);

    return Response.json(task, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireAuth({
      roles: ["ADMIN", "MANAGER", "RECEPTIONIST"],
    });

    if (!user) {
      throw new ApiError("Unauthorized", 401);
    }

    const body = await req.json();

    const taskId =
      typeof body.taskId === "string" ? body.taskId.trim() : "";

    const assignedToUserId =
      typeof body.assignedToUserId === "string"
        ? body.assignedToUserId.trim()
        : "";

    if (!taskId || !assignedToUserId) {
      throw new ApiError(
        "taskId and assignedToUserId are required",
        400,
      );
    }

    const task = await prisma.housekeepingTask.findFirst({
      where: {
        id: taskId,
        hotelId: user.hotelId,
      },
      include: {
        room: {
          select: {
            roomNumber: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (!task) {
      throw new ApiError("Housekeeping task not found", 404);
    }

    if (task.status === "IN_REVIEW") {
      throw new ApiError(
        "Resolve the pending review before reassigning this task.",
        409,
      );
    }

    if (task.status === "DONE") {
      throw new ApiError(
        "Completed tasks cannot be reassigned.",
        409,
      );
    }

    if (
      task.status !== "PENDING" &&
      task.status !== "IN_PROGRESS"
    ) {
      throw new ApiError(
        "This task cannot be reassigned in its current status.",
        409,
      );
    }

    if (task.assignedToUserId === assignedToUserId) {
      throw new ApiError(
        "This task is already assigned to that housekeeper.",
        400,
      );
    }

    const newAssignee = await prisma.user.findFirst({
      where: {
        id: assignedToUserId,
        hotelId: user.hotelId,
        role: "HOUSEKEEPING",
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
      },
    });

    if (!newAssignee) {
      throw new ApiError(
        "Select an active housekeeper from this hotel.",
        400,
      );
    }

    const notification = {
      hotelId: user.hotelId,
      userId: newAssignee.id,
      title: "Housekeeping task reassigned",
      message: `Room ${task.room.roomNumber} has been reassigned to you.`,
      type: "TASK_ASSIGNED" as const,
    };

    const updatedTask = await prisma.$transaction(async (tx) => {
      const updated = await tx.housekeepingTask.update({
        where: { id: task.id },
        data: { assignedToUserId: newAssignee.id },
        include: {
          assignedTo: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });

      await createNotification(
        { ...notification, taskId: task.id },
        tx,
      );

      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: "HOUSEKEEPING_TASK_REASSIGNED",
        entityType: "housekeeping_task",
        metadata: {
          taskId: task.id,
          roomId: task.roomId,
          previousAssigneeId: task.assignedToUserId,
          previousAssigneeName: task.assignedTo.fullName,
          newAssigneeId: newAssignee.id,
          newAssigneeName: newAssignee.fullName,
          previousStatus: task.status,
        },
      });

      return updated;
    });

    try {
      await sendNotificationPush(notification);
    } catch (error) {
      console.error("Reassignment push notification failed:", error);
    }

    return Response.json({
      message: "Housekeeping task reassigned successfully.",
      task: updatedTask,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
