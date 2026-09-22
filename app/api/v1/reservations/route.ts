import { prisma } from "../../../../lib/db";
import { requireAuth } from "../../../../lib/middleware/requireAuth";
import { createReservationSchema } from "../../../../lib/validators/reservation";
import { writeAuditLog } from "../../../../lib/services/audit.service";
import { ApiError, handleRouteError } from "../../../../lib/api/errors";

function getStartOfToday() {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return today;
}

export async function GET() {
  try {
    const user = await requireAuth({
      roles: ["ADMIN","MANAGER", "RECEPTIONIST"],
    });

    if (!user) {
      throw new ApiError("Unauthorized", 401);
    }

    const reservations = await prisma.reservation.findMany({
      where: {
        hotelId: user.hotelId,
      },
      include: {
        room: true,
        guest: true,
      },
      orderBy: {
        checkInDate: "desc",
      },
    });

    return Response.json(reservations);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    // Get the logged-in receptionist/manager.
    // This means the frontend does NOT provide createdByUserId.
    const user = await requireAuth({
      roles: ["ADMIN","MANAGER", "RECEPTIONIST"],
    });

    if (!user) {
      throw new ApiError("Unauthorized", 401);
    }

    const body = await req.json();

    const parsed = createReservationSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError("Invalid request body", 400);
    }

    const {
      roomId,
      guestId,
      checkInDate,
      checkOutDate,
      paymentStatus,
    } = parsed.data;

    // ---------------------------------------------------------
    // 1. CHECK-IN CANNOT BE BEFORE TODAY
    // ---------------------------------------------------------

    const today = getStartOfToday();

    const checkIn = new Date(checkInDate);
    checkIn.setHours(0, 0, 0, 0);

    if (checkIn.getTime() < today.getTime()) {
      throw new ApiError(
        "Check-in date cannot be before today",
        400
      );
    }

    // ---------------------------------------------------------
    // 2. CHECK-OUT MUST BE AFTER CHECK-IN
    // ---------------------------------------------------------

    const checkOut = new Date(checkOutDate);
    checkOut.setHours(0, 0, 0, 0);

    if (checkOut.getTime() <= checkIn.getTime()) {
      throw new ApiError(
        "Check-out date must be after check-in date",
        400
      );
    }

    // ---------------------------------------------------------
    // 3. CREATE RESERVATION INSIDE A TRANSACTION
    // ---------------------------------------------------------

    const reservation = await prisma.$transaction(async (tx) => {
      // -------------------------------------------------------
      // Find room belonging to the logged-in user's hotel
      // -------------------------------------------------------

      const room = await tx.room.findFirst({
        where: {
          id: roomId,
          hotelId: user.hotelId,
        },
      });

      if (!room) {
        throw new ApiError("Room not found", 404);
      }

      // -------------------------------------------------------
      // 4. DO NOT ALLOW UNAVAILABLE ROOM STATUS
      // -------------------------------------------------------

      const unavailableRoomStatuses = [
        "OCCUPIED",
        "NEEDS_CLEANING",
        "CLEANING",
        "OUT_OF_SERVICE",
      ] as const;

      if (
        unavailableRoomStatuses.includes(
          room.status as (typeof unavailableRoomStatuses)[number]
        )
      ) {
        throw new ApiError(
          "This room is not available for reservation",
          409
        );
      }

      // -------------------------------------------------------
      // Find guest belonging to the same hotel
      // -------------------------------------------------------

      const guest = await tx.guest.findFirst({
        where: {
          id: guestId,
          hotelId: user.hotelId,
        },
      });

      if (!guest) {
        throw new ApiError("Guest not found", 404);
      }

      // -------------------------------------------------------
      // 5. CHECK FOR RESERVATION DATE OVERLAP
      // -------------------------------------------------------

      const overlap = await tx.reservation.findFirst({
        where: {
          hotelId: user.hotelId,
          roomId,
          status: {
            in: ["BOOKED", "CHECKED_IN"],
          },
          checkInDate: {
            lt: checkOut,
          },
          checkOutDate: {
            gt: checkIn,
          },
        },
      });

      if (overlap) {
        throw new ApiError(
          "Room is already booked for those dates",
          409
        );
      }

      // -------------------------------------------------------
      // 6. CALCULATE NUMBER OF NIGHTS
      // -------------------------------------------------------

      const millisecondsPerDay =
        1000 * 60 * 60 * 24;

      const nights = Math.ceil(
        (checkOut.getTime() - checkIn.getTime()) /
          millisecondsPerDay
      );

      if (nights <= 0) {
        throw new ApiError(
          "Check-out date must be after check-in date",
          400
        );
      }

      // -------------------------------------------------------
      // 7. PRICE COMES FROM THE ROOM
      // -------------------------------------------------------

      const pricePerNight = room.basePrice;

      const totalPrice = pricePerNight.mul(nights);

      // -------------------------------------------------------
      // 8. CREATE RESERVATION
      //
      // Notice:
      // - No price comes from frontend
      // - No totalPrice comes from frontend
      // - No createdByUserId comes from frontend
      // - Status is automatically BOOKED
      // -------------------------------------------------------

      const newReservation =
        await tx.reservation.create({
          data: {
            hotelId: user.hotelId,

            roomId,

            guestId,

            createdByUserId: user.userId,

            checkInDate: checkIn,

            checkOutDate: checkOut,

            pricePerNight,

            totalPrice,

            status: "BOOKED",

            paymentStatus:
              paymentStatus ?? "UNPAID",
          },

          include: {
            room: true,
            guest: true,
          },
        });

      // -------------------------------------------------------
      // 9. MARK ROOM AS RESERVED
      // -------------------------------------------------------

      await tx.room.update({
        where: {
          id: roomId,
        },

        data: {
          status: "RESERVED",
        },
      });

      // -------------------------------------------------------
      // 10. AUDIT LOG
      // -------------------------------------------------------

      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: "RESERVATION_CREATED",
        entityType: "reservation",
        metadata: {
          reservationId: newReservation.id,
          roomId,
          guestId,
          checkInDate: checkIn.toISOString(),
          checkOutDate: checkOut.toISOString(),
          pricePerNight: pricePerNight.toString(),
          totalPrice: totalPrice.toString(),
        },
      });

      return newReservation;
    });

    return Response.json(reservation, {
      status: 201,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}