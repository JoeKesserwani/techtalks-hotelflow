import { prisma } from "../../../../lib/db";
import { requireAuth } from "../../../../lib/middleware/requireAuth";
import { updateHotelSchema } from "../../../../lib/validators/hotel";
import { ApiError, handleRouteError } from "../../../../lib/api/errors";
import { writeAuditLog } from "../../../../lib/services/audit.service";

export async function GET() {
  try {
    const user = await requireAuth({
      roles: ["ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING"],
    });
    if (!user) throw new ApiError("Unauthorized", 401);

    const hotel = await prisma.hotel.findUnique({
      where: { id: user.hotelId },
    });
    if (!hotel) throw new ApiError("Hotel not found", 404);

    return Response.json(hotel);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireAuth({ roles: ["ADMIN", "MANAGER"] });
    if (!user) throw new ApiError("Unauthorized", 401);

    const body = await req.json();
    const parsed = updateHotelSchema.safeParse(body);
    if (!parsed.success) throw new ApiError("Invalid request body", 400);

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.hotel.findUnique({
        where: { id: user.hotelId },
      });
      if (!current) throw new ApiError("Hotel not found", 404);

      const changes = Object.keys(parsed.data).filter(
        (field) =>
          current[field as keyof typeof current] !==
          parsed.data[field as keyof typeof parsed.data],
      );
      const hotel = await tx.hotel.update({
        where: { id: user.hotelId },
        data: parsed.data,
      });

      if (changes.length > 0) {
        await writeAuditLog(tx, {
          hotelId: user.hotelId,
          userId: user.userId,
          action: "HOTEL_SETTINGS_UPDATED",
          entityType: "hotel",
          metadata: { changes },
        });
      }

      return hotel;
    });

    return Response.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
