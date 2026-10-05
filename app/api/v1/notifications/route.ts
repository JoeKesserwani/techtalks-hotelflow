import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/middleware/requireAuth";
import { ApiError, handleRouteError } from "@/lib/api/errors";

export async function GET() {
  try {
    const user = await requireAuth({
      roles: ["ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING"],
    });
    if (!user) throw new ApiError("Unauthorized", 401);

    const items = await prisma.$queryRaw<{
      id: string;
      title: string;
      message: string;
      type: "TASK_ASSIGNED" | "TASK_APPROVED" | "TASK_REJECTED";
      is_read: boolean;
      created_at: Date;
      task_id: string | null;
      task_notes: string | null;
    }[]>`
      SELECT
        n.id,
        n.title,
        n.message,
        n.type,
        n.is_read,
        n.created_at,
        n.task_id,
        ht.notes AS task_notes
      FROM notifications n
      LEFT JOIN housekeeping_tasks ht ON ht.id = n.task_id
      WHERE n.hotel_id = ${user.hotelId}
        AND n.user_id = ${user.userId}
      ORDER BY n.created_at DESC
    `;

    return Response.json(
      items.map((item) => ({
        id: item.id,
        title: item.title,
        message: item.message,
        type: item.type,
        isRead: Boolean(item.is_read),
        createdAt: item.created_at,
        taskId: item.task_id,
        detail: item.task_notes ?? null,
      })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
