import { prisma } from "../../../../../../lib/db";
import { requireAuth } from "../../../../../../lib/middleware/requireAuth";
import { writeAuditLog } from "../../../../../../lib/services/audit.service";
import {
  ApiError,
  handleRouteError,
} from "../../../../../../lib/api/errors";

/*
 * Hotel business date.
 */
function getTodayInBeirut() {
  const formatter = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Beirut",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  );

  return formatter.format(new Date());
}

function getDateOnly(
  value: Date | string
) {
  const date =
    typeof value === "string"
      ? value
      : value.toISOString();

  return date.split("T")[0];
}

export async function POST(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
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

    const { id } = await params;

    /*
     * FIND RESERVATION
     */

    const reservation =
      await prisma.reservation.findFirst({
        where: {
          id,
          hotelId: user.hotelId,
        },
        include: {
          room: true,
          guest: true,
        },
      });

    if (!reservation) {
      throw new ApiError(
        "Reservation not found",
        404
      );
    }

    /*
     * ALREADY CHECKED IN
     */

    if (
      reservation.status ===
      "CHECKED_IN"
    ) {
      return Response.json(
        reservation
      );
    }

    /*
     * MUST BE BOOKED
     */

    if (
      reservation.status !==
      "BOOKED"
    ) {
      throw new ApiError(
        "Only upcoming reservations can be checked in",
        400
      );
    }

    /*
     * CHECK-IN IS ONLY ALLOWED
     * ON THE RESERVATION'S CHECK-IN DATE.
     */

    const today =
      getTodayInBeirut();

    const reservationCheckIn =
      getDateOnly(
        reservation.checkInDate
      );

    if (
      reservationCheckIn !== today
    ) {
      throw new ApiError(
        "Check-in is only allowed on the reservation check-in date",
        400
      );
    }

    /*
     * TRANSACTION
     */

    const updatedReservation =
      await prisma.$transaction(
        async (tx) => {
          const room =
            await tx.room.findFirst({
              where: {
                id: reservation.roomId,
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
           * Physical room statuses that
           * cannot accept a guest.
           */

          const unavailableStatuses = [
            "OCCUPIED",
            "NEEDS_CLEANING",
            "CLEANING",
            "OUT_OF_SERVICE",
            "MAINTENANCE",
          ] as const;

          if (
            unavailableStatuses.includes(
              room.status as
                (typeof unavailableStatuses)[number]
            )
          ) {
            throw new ApiError(
              "This room is not available for check-in",
              409
            );
          }

          /*
           * BOOKED -> CHECKED_IN
           */

          const updated =
            await tx.reservation.update({
              where: {
                id: reservation.id,
              },

              data: {
                status:
                  "CHECKED_IN",
              },

              include: {
                room: true,
                guest: true,
              },
            });

          /*
           * Room becomes OCCUPIED.
           */

          await tx.room.update({
            where: {
              id: reservation.roomId,
            },

            data: {
              status: "OCCUPIED",
            },
          });

          /*
           * AUDIT
           */

          await writeAuditLog(
            tx,
            {
              hotelId:
                user.hotelId,

              userId:
                user.userId,

              action:
                "RESERVATION_CHECKED_IN",

              entityType:
                "reservation",

              metadata: {
                reservationId:
                  reservation.id,

                roomId:
                  reservation.roomId,

                guestId:
                  reservation.guestId,
              },
            }
          );

          return updated;
        }
      );

    return Response.json(
      updatedReservation
    );
  } catch (err) {
    return handleRouteError(err);
  }
}