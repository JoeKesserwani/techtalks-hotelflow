import { prisma } from "../../../../lib/db";
import { requireAuth } from "../../../../lib/middleware/requireAuth";
import { createRoomSchema } from "../../../../lib/validators/room";
import { writeAuditLog } from "../../../../lib/services/audit.service";
import { ApiError, handleRouteError } from "../../../../lib/api/errors";

export async function GET() {
  try {
    const user = await requireAuth({
      roles: ["ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING"],
    });
    if (!user) throw new ApiError("Unauthorized", 401);

    const rooms = await prisma.room.findMany({
      where: { hotelId: user.hotelId },
      orderBy: { roomNumber: "asc" },
    });

    return Response.json(rooms);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth({ roles: ["ADMIN", "MANAGER", "RECEPTIONIST"] });
    if (!user) throw new ApiError("Unauthorized", 401);

    const body = await req.json();
    const parsed = createRoomSchema.safeParse(body);
    if (!parsed.success) throw new ApiError("Invalid request body", 400);

    const existing = await prisma.room.findFirst({
      where: { hotelId: user.hotelId, roomNumber: parsed.data.roomNumber },
    });
    if (existing)
      throw new ApiError("A room with this number already exists", 409);

    const room = await prisma.$transaction(async (tx) => {
      const created = await tx.room.create({
        data: {
          hotelId: user.hotelId,
          roomNumber: parsed.data.roomNumber,
          roomType: parsed.data.roomType,
          floor: parsed.data.floor,
          capacity: parsed.data.capacity,
          basePrice: parsed.data.basePrice,
        },
      });

      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: "ROOM_CREATED",
        entityType: "room",
        metadata: { roomId: created.id, roomNumber: created.roomNumber },
      });

      return created;
    });

    return Response.json(room, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
