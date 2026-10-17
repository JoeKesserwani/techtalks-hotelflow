import { prisma } from "../../../../lib/db";
import { Prisma } from "@/app/generated/prisma/client";
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

    const email = parsed.data.email?.trim().toLowerCase() || undefined;
    const phone = parsed.data.phone?.trim() || undefined;
    const passportNumber = parsed.data.passportNumber?.trim() || undefined;
    const duplicateFilters: Prisma.GuestWhereInput[] = [];
    if (email) duplicateFilters.push({ email });
    if (phone) duplicateFilters.push({ phone });
    if (passportNumber) duplicateFilters.push({ passportNumber });

    const guest = await prisma.$transaction(
      async (tx) => {
        if (duplicateFilters.length > 0) {
          const existingGuests = await tx.guest.findMany({
            where: { hotelId: user.hotelId, OR: duplicateFilters },
            select: { email: true, phone: true, passportNumber: true },
          });
          const emailExists =
            !!email &&
            existingGuests.some(
              (existing) => existing.email?.trim().toLowerCase() === email,
            );
          const phoneExists =
            !!phone &&
            existingGuests.some((existing) => existing.phone?.trim() === phone);
          const passportNumberExists =
            !!passportNumber &&
            existingGuests.some(
              (existing) => existing.passportNumber?.trim() === passportNumber,
            );
          const duplicateFields = [
            emailExists && "Email",
            phoneExists && "Phone number",
            passportNumberExists && "Passport number",
          ].filter((field): field is string => Boolean(field));

          if (duplicateFields.length > 0) {
            const verb = duplicateFields.length === 1 ? "is" : "are";
            throw new ApiError(
              `${duplicateFields.join(" and ")} ${verb} already registered.`,
              409,
            );
          }
        }

        const created = await tx.guest.create({
          data: {
            hotelId: user.hotelId,
            fullName: parsed.data.fullName,
            phone,
            email,
            passportNumber,
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
      },
      { maxWait: 10_000 },
    );

    return Response.json(guest, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
