import { prisma } from "../../../../lib/db";
import { requireAuth } from "../../../../lib/middleware/requireAuth";
import { createGuestSchema } from "../../../../lib/validators/guest";
import { writeAuditLog } from "../../../../lib/services/audit.service";
import { ApiError, handleRouteError } from "../../../../lib/api/errors";

export async function GET() {
  try {
    const user = await requireAuth({
      roles: ["MANAGER", "RECEPTIONIST", "ADMIN"],
    });
    if (!user) throw new ApiError("Unauthorized", 401);

    const guests = await prisma.guest.findMany({
      where: { hotelId: user.hotelId },
      orderBy: { fullName: "asc" },
      include: {
        reservations: {
          include: { room: true },
          orderBy: { checkInDate: "desc" },
          take: 1,
        },
      },
    });

    return Response.json(guests);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth({
      roles: ["MANAGER", "RECEPTIONIST", "ADMIN"],
    });
    if (!user) throw new ApiError("Unauthorized", 401);

    const body = await req.json();
    const parsed = createGuestSchema.safeParse(body);
    if (!parsed.success)
      throw new ApiError("Invalid request body, check the formats", 400);

    const guest = await prisma.$transaction(async (tx) => {
      const created = await tx.guest.create({
        data: {
          hotelId: user.hotelId,
          fullName: parsed.data.fullName,
          phone: parsed.data.phone,
          email: parsed.data.email,
          passportNumber: parsed.data.passportNumber,
          note: parsed.data.note,
        },
      });

      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: "GUEST_CREATED",
        entityType: "guest",
        metadata: { guestId: created.id },
      });

      return created;
    });

    return Response.json(guest, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
