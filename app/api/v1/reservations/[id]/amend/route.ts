import { prisma } from "../../../../../../lib/db";
import { requireAuth } from "../../../../../../lib/middleware/requireAuth";
import { writeAuditLog } from "../../../../../../lib/services/audit.service";
import { ApiError, handleRouteError } from "../../../../../../lib/api/errors";

/*
 * PATCH /api/v1/reservations/:id/amend
 * body: { roomId?: string, checkInDate?: "YYYY-MM-DD", checkOutDate?: "YYYY-MM-DD" }
 *
 * One state-aware endpoint for changing a live reservation.
 *
 * BOOKED (not arrived yet)
 *   - may change room, check-in and check-out
 *   - check-in cannot be in the past, check-out must be after check-in
 *   - changing the ROOM re-prices at the new room's base price; changing only the
 *     dates keeps the rate that was agreed when the booking was made
 *   - room.status is never touched (same rule as reservation creation)
 *
 * CHECKED_IN (in-house)
 *   - may EXTEND the stay (new check-out later than the current one, and after today)
 *   - may MOVE to another room that is physically ready and free until check-out
 *   - check-in date is immutable; leaving early is done through check-out
 *   - the agreed nightly rate is kept (check-out re-computes from reservation.pricePerNight,
 *     so changing the rate here would be silently overwritten)
 *   - on a move: old room -> NEEDS_CLEANING, new room -> OCCUPIED, in the same transaction
 *
 * Why not PATCH /reservations/:id: it rejects every reservation whose check-in is before
 * today (so it fails for any in-house guest) and it cannot change the room.
 *
 * If a longer stay pushes a PAID reservation above what was paid, it becomes PARTIAL.
 * Adjust the status names below to match your Prisma PaymentStatus enum.
 */

const TZ = "Asia/Beirut";
const DAY = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const IN_HOUSE_BLOCKED: string[] = [
  "OCCUPIED",
  "NEEDS_CLEANING",
  "CLEANING",
  "IN_REVIEW",
  "OUT_OF_SERVICE",
  "MAINTENANCE",
];
const NEVER_BOOKABLE: string[] = ["OUT_OF_SERVICE", "MAINTENANCE"];

const todayInBeirut = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const toUtc = (d: string) => new Date(`${d}T00:00:00.000Z`);
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

function isRealDate(v: unknown): v is string {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  const d = toUtc(v);
  return !Number.isNaN(d.getTime()) && dateOnly(d) === v;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const user = await requireAuth({
      roles: ["ADMIN", "MANAGER", "RECEPTIONIST"],
    });
    if (!user) throw new ApiError("Unauthorized", 401);

    const raw = await req.json().catch(() => null);
    if (!raw || typeof raw !== "object")
      throw new ApiError("Invalid request body", 400);
    const { roomId, checkInDate, checkOutDate } = raw as Record<
      string,
      unknown
    >;

    if (roomId !== undefined && (typeof roomId !== "string" || !roomId)) {
      throw new ApiError("Invalid room", 400);
    }
    if (checkInDate !== undefined && !isRealDate(checkInDate)) {
      throw new ApiError("Check-in date must be YYYY-MM-DD", 400);
    }
    if (checkOutDate !== undefined && !isRealDate(checkOutDate)) {
      throw new ApiError("Check-out date must be YYYY-MM-DD", 400);
    }

    const today = todayInBeirut();

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.reservation.findFirst({
        where: { id, hotelId: user.hotelId },
        include: { room: true },
      });
      if (!current) throw new ApiError("Reservation not found", 404);

      if (current.status !== "BOOKED" && current.status !== "CHECKED_IN") {
        throw new ApiError(
          "Only upcoming or in-house reservations can be changed",
          400,
        );
      }
      const inHouse = current.status === "CHECKED_IN";

      const curIn = dateOnly(current.checkInDate);
      const curOut = dateOnly(current.checkOutDate);
      const newIn = (checkInDate as string | undefined) ?? curIn;
      const newOut = (checkOutDate as string | undefined) ?? curOut;
      const newRoomId = (roomId as string | undefined) ?? current.roomId;
      const roomChanged = newRoomId !== current.roomId;

      if (newIn === curIn && newOut === curOut && !roomChanged) {
        throw new ApiError("Nothing to change", 400);
      }

      if (inHouse) {
        if (newIn !== curIn) {
          throw new ApiError(
            "The check-in date of an in-house guest cannot be changed",
            400,
          );
        }
        if (newOut < curOut) {
          throw new ApiError(
            "To leave early, check the guest out. A stay can only be extended here",
            400,
          );
        }
        if (newOut !== curOut && newOut <= today) {
          throw new ApiError("The new check-out date must be after today", 400);
        }
      } else {
        if (newIn < today)
          throw new ApiError("Check-in date cannot be before today", 400);
        if (newOut <= newIn)
          throw new ApiError("Check-out date must be after check-in date", 400);
      }

      const room = roomChanged
        ? await tx.room.findFirst({
            where: { id: newRoomId, hotelId: user.hotelId },
          })
        : current.room;
      if (!room) throw new ApiError("Room not found", 404);

      if (roomChanged) {
        const blocked = inHouse ? IN_HOUSE_BLOCKED : NEVER_BOOKABLE;
        if (blocked.includes(String(room.status))) {
          throw new ApiError(
            `Room ${room.roomNumber} is not available (${String(room.status).toLowerCase().replace(/_/g, " ")})`,
            409,
          );
        }
      }

      /*
       * Overlap rule identical to creation: existing.in < new.out && existing.out > new.in.
       * For a mid-stay room move only the nights from today on matter in the new room.
       */
      const windowStart =
        inHouse && roomChanged ? (today > curIn ? today : curIn) : newIn;
      const clash = await tx.reservation.findFirst({
        where: {
          id: { not: id },
          hotelId: user.hotelId,
          roomId: newRoomId,
          status: { in: ["BOOKED", "CHECKED_IN"] },
          checkInDate: { lt: toUtc(newOut) },
          checkOutDate: { gt: toUtc(windowStart) },
        },
        select: { checkInDate: true, checkOutDate: true },
      });
      if (clash) {
        throw new ApiError(
          `Room ${room.roomNumber} is already booked from ${dateOnly(clash.checkInDate)} to ${dateOnly(clash.checkOutDate)}`,
          409,
        );
      }

      const pricePerNight =
        !inHouse && roomChanged ? room.basePrice : current.pricePerNight;
      const nights = Math.round(
        (toUtc(newOut).getTime() - toUtc(newIn).getTime()) / DAY,
      );
      if (nights <= 0)
        throw new ApiError("Reservation must be at least one night", 400);
      const totalPrice = pricePerNight.mul(nights);

      const paymentStatus = (
        current.paymentStatus === "PAID" &&
        totalPrice.greaterThan(current.totalPrice)
          ? "PARTIAL"
          : current.paymentStatus
      ) as typeof current.paymentStatus;

      const result = await tx.reservation.update({
        where: { id },
        data: {
          roomId: newRoomId,
          checkInDate: toUtc(newIn),
          checkOutDate: toUtc(newOut),
          pricePerNight,
          totalPrice,
          paymentStatus,
        },
        include: { room: true, guest: true },
      });

      if (inHouse && roomChanged) {
        await tx.room.update({
          where: { id: current.roomId },
          data: { status: "NEEDS_CLEANING" },
        });
        await tx.room.update({
          where: { id: newRoomId },
          data: { status: "OCCUPIED" },
        });
      }

      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: "RESERVATION_UPDATED",
        entityType: "reservation",
        metadata: {
          reservationId: id,
          status: current.status,
          kind: roomChanged
            ? inHouse
              ? "ROOM_MOVE"
              : "ROOM_CHANGE"
            : "DATES_CHANGE",
          changes: {
            roomId: newRoomId,
            previousRoomId: current.roomId,
            checkInDate: newIn,
            checkOutDate: newOut,
            previousCheckOutDate: curOut,
            pricePerNight: pricePerNight.toString(),
            totalPrice: totalPrice.toString(),
            previousTotalPrice: current.totalPrice.toString(),
            paymentStatus,
          },
        },
      });

      return result;
    });

    return Response.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
