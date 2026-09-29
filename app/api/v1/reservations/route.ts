import { prisma } from "../../../../lib/db";
import { requireAuth } from "../../../../lib/middleware/requireAuth";
import { createReservationSchema } from "../../../../lib/validators/reservation";
import { writeAuditLog } from "../../../../lib/services/audit.service";
import {
  ApiError,
  handleRouteError,
} from "../../../../lib/api/errors";

/*
 * HotelFlow uses Asia/Beirut for hotel business dates.
 */
function getTodayInBeirut() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Beirut",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

/*
 * Convert YYYY-MM-DD to a Date at UTC midnight.
 *
 * IMPORTANT:
 * Do NOT use:
 *
 *   new Date(year, month - 1, day)
 *
 * because that uses the server's local timezone.
 *
 * Using UTC midnight keeps the calendar date stable.
 */
function dateOnlyToDate(value: string) {
  const [year, month, day] = value
    .split("-")
    .map(Number);

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      0,
      0,
      0,
      0
    )
  );
}

/*
 * GET RESERVATIONS
 */
export async function GET() {
  try {
    const user = await requireAuth({
      roles: ["ADMIN","MANAGER", "RECEPTIONIST"],
    });

    if (!user) {
      throw new ApiError(
        "Unauthorized",
        401
      );
    }

    const reservations =
      await prisma.reservation.findMany({
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

/*
 * CREATE RESERVATION
 */
export async function POST(
  req: Request
) {
  try {
    const user = await requireAuth({
      roles: ["ADMIN","MANAGER", "RECEPTIONIST"],
    });

    if (!user) {
      throw new ApiError(
        "Unauthorized",
        401
      );
    }

    const body = await req.json();

    const parsed =
      createReservationSchema.safeParse(
        body
      );

    if (!parsed.success) {
      throw new ApiError(
        "Invalid request body",
        400
      );
    }

    const {
      roomId,
      guestId,
      checkInDate,
      checkOutDate,
      paymentStatus,
    } = parsed.data;

    /*
     * Keep reservation dates as YYYY-MM-DD.
     *
     * Do not convert them to ISO strings here.
     */
    const checkInValue =
      typeof checkInDate === "string"
        ? checkInDate
        : checkInDate
            .toISOString()
            .split("T")[0];

    const checkOutValue =
      typeof checkOutDate === "string"
        ? checkOutDate
        : checkOutDate
            .toISOString()
            .split("T")[0];

    /*
     * CHECK-IN MUST BE TODAY OR FUTURE.
     */
    const today =
      getTodayInBeirut();

    if (checkInValue < today) {
      throw new ApiError(
        "Check-in date cannot be before today",
        400
      );
    }

    /*
     * CHECK-OUT MUST BE AFTER CHECK-IN.
     */
    if (
      checkOutValue <=
      checkInValue
    ) {
      throw new ApiError(
        "Check-out date must be after check-in date",
        400
      );
    }

    /*
     * Convert the date-only strings to
     * UTC-midnight Date objects.
     */
    const checkIn =
      dateOnlyToDate(checkInValue);

    const checkOut =
      dateOnlyToDate(checkOutValue);

    /*
     * CREATE INSIDE TRANSACTION
     */
    const reservation =
      await prisma.$transaction(
        async (tx) => {
          /*
           * ROOM
           */
          const room =
            await tx.room.findFirst({
              where: {
                id: roomId,
                hotelId: user.hotelId,
              },
            });

          if (!room) {
            throw new ApiError(
              "Room not found",
              404
            );
          }

          /*
           * IMPORTANT:
           *
           * We DO NOT check the room's
           * current physical status here.
           *
           * A room can be OCCUPIED today
           * and still be reserved for a
           * future date.
           */

          /*
           * GUEST
           */
          const guest =
            await tx.guest.findFirst({
              where: {
                id: guestId,
                hotelId: user.hotelId,
              },
            });

          if (!guest) {
            throw new ApiError(
              "Guest not found",
              404
            );
          }

          /*
           * PREVENT OVERLAPPING RESERVATIONS.
           *
           * BOOKED and CHECKED_IN reservations
           * block the room for overlapping dates.
           */
          const overlap =
            await tx.reservation.findFirst({
              where: {
                hotelId:
                  user.hotelId,

                roomId,

                status: {
                  in: [
                    "BOOKED",
                    "CHECKED_IN",
                  ],
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

          /*
           * NUMBER OF NIGHTS
           */
          const millisecondsPerDay =
            1000 *
            60 *
            60 *
            24;

          const nights =
            Math.round(
              (checkOut.getTime() -
                checkIn.getTime()) /
                millisecondsPerDay
            );

          if (nights <= 0) {
            throw new ApiError(
              "Check-out date must be after check-in date",
              400
            );
          }

          /*
           * PRICE COMES FROM ROOM
           */
          const pricePerNight =
            room.basePrice;

          const totalPrice =
            pricePerNight.mul(
              nights
            );

          /*
           * CREATE RESERVATION
           */
          const newReservation =
            await tx.reservation.create({
              data: {
                hotelId:
                  user.hotelId,

                roomId,

                guestId,

                /*
                 * The current authenticated
                 * receptionist/manager creates
                 * the reservation.
                 */
                createdByUserId:
                  user.userId,

                checkInDate:
                  checkIn,

                checkOutDate:
                  checkOut,

                pricePerNight,

                totalPrice,

                status: "BOOKED",

                paymentStatus:
                  paymentStatus ??
                  "UNPAID",
              },

              include: {
                room: true,
                guest: true,
              },
            });

          /*
           * IMPORTANT:
           *
           * Do NOT change room.status.
           *
           * The room's current status represents
           * its physical state right now.
           *
           * The reservation represents a future
           * booking.
           */

          /*
           * AUDIT LOG
           *
           * Store date-only values.
           */
          await writeAuditLog(
            tx,
            {
              hotelId:
                user.hotelId,

              userId:
                user.userId,

              action:
                "RESERVATION_CREATED",

              entityType:
                "reservation",

              metadata: {
                reservationId:
                  newReservation.id,

                roomId,

                guestId,

                checkInDate:
                  checkInValue,

                checkOutDate:
                  checkOutValue,

                pricePerNight:
                  pricePerNight.toString(),

                totalPrice:
                  totalPrice.toString(),
              },
            }
          );

          return newReservation;
        }
      );

    return Response.json(
      reservation,
      {
        status: 201,
      }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}