
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/middleware/requireAuth";
import { ApiError, handleRouteError } from "@/lib/api/errors";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth({
      roles: ["ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING"],
    });
    if (!user) throw new ApiError("Unauthorized", 401);

    const { id } = await params;

    const rowsUpdated = await prisma.$executeRaw`
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE id = ${id}
        AND user_id = ${user.userId}
        AND hotel_id = ${user.hotelId}
        AND is_read = false
    `;

    if (rowsUpdated === 0) {
      const existing = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM notifications
        WHERE id = ${id}
          AND user_id = ${user.userId}
          AND hotel_id = ${user.hotelId}
        LIMIT 1
      `;

      if (existing.length === 0) {
        throw new ApiError("Notification not found", 404);
      }
    }

    return Response.json({
      message: "Notification marked as read",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}