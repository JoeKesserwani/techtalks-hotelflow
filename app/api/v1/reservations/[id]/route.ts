
import { prisma } from "../../../../../lib/db";
import { requireAuth } from "../../../../../lib/middleware/requireAuth";
import { updateReservationSchema } from "../../../../../lib/validators/reservation";
import { writeAuditLog } from "../../../../../lib/services/audit.service";
import {
  ApiError,
  handleRouteError,
} from "../../../../../lib/api/errors";

function getStartOfToday() {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return today;
}

function calculateNights(
  checkInDate: Date,
  checkOutDate: Date
) {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);

  checkIn.setHours(0, 0, 0, 0);
  checkOut.setHours(0, 0, 0, 0);

  const difference =
    checkOut.getTime() -
    checkIn.getTime();

  return Math.ceil(
    difference /
      (1000 * 60 * 60 * 24)
  );
}

/*
 * --------------------------------------------------
 * GET ONE RESERVATION
 * --------------------------------------------------
 */

export async function GET(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await params;

    const user = await requireAuth({
      roles: ["MANAGER", "RECEPTIONIST"],
    });

    if (!user) {
      throw new ApiError(
        "Unauthorized",
        401
      );
    }

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

    return Response.json(reservation);
  } catch (err) {
    return handleRouteError(err);
  }
}

/*
 * --------------------------------------------------
 * UPDATE RESERVATION
 * --------------------------------------------------
 *
 * Edit is allowed for:
 *
 * BOOKED
 * CHECKED_IN
 * CHECKED_OUT
 *
 * Edit does NOT change the reservation status.
 *
 * The room cannot be changed.
 *
 * Price always comes from Room.basePrice.
 *
 */

export async function PATCH(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await params;

    const user = await requireAuth({
      roles: ["MANAGER", "RECEPTIONIST"],
    });

    if (!user) {
      throw new ApiError(
        "Unauthorized",
        401
      );
    }

    const body = await req.json();

    const parsed =
      updateReservationSchema.safeParse(
        body
      );

    if (!parsed.success) {
      throw new ApiError(
        "Invalid request body",
        400
      );
    }

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
     * We intentionally DO NOT check:
     *
     * reservation.status === "BOOKED"
     *
     * because Edit is allowed for:
     *
     * BOOKED
     * CHECKED_IN
     * CHECKED_OUT
     */

    const newCheckInDate =
      parsed.data.checkInDate ??
      reservation.checkInDate;

    const newCheckOutDate =
      parsed.data.checkOutDate ??
      reservation.checkOutDate;

    /*
     * Check-in cannot be before today.
     */
    const checkIn =
      new Date(newCheckInDate);

    const today =
      getStartOfToday();

    checkIn.setHours(
      0,
      0,
      0,
      0
    );

    if (
      checkIn.getTime() <
      today.getTime()
    ) {
      throw new ApiError(
        "Check-in date cannot be before today",
        400
      );
    }

    /*
     * Check-out must be after check-in.
     */
    const checkOut =
      new Date(newCheckOutDate);

    checkOut.setHours(
      0,
      0,
      0,
      0
    );

    if (
      checkOut.getTime() <=
      checkIn.getTime()
    ) {
      throw new ApiError(
        "Check-out date must be after check-in date",
        400
      );
    }

    /*
     * Calculate nights.
     */
    const nights =
      calculateNights(
        new Date(newCheckInDate),
        new Date(newCheckOutDate)
      );

    if (nights <= 0) {
      throw new ApiError(
        "Check-out date must be after check-in date",
        400
      );
    }

    const updated =
      await prisma.$transaction(
        async (tx) => {
          /*
           * Get the real room from MySQL.
           */
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
           * Prevent overlapping active
           * reservations.
           *
           * CHECKED_OUT reservations are
           * ignored because they are no
           * longer active.
           */
          const overlap =
            await tx.reservation.findFirst({
              where: {
                id: {
                  not: id,
                },

                hotelId:
                  user.hotelId,

                roomId:
                  reservation.roomId,

                status: {
                  in: [
                    "BOOKED",
                    "CHECKED_IN",
                  ],
                },

                checkInDate: {
                  lt: newCheckOutDate,
                },

                checkOutDate: {
                  gt: newCheckInDate,
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
           * Price always comes from
           * Room.basePrice.
           *
           * The receptionist cannot
           * manually change it.
           */
          const pricePerNight =
            room.basePrice;

          const totalPrice =
            pricePerNight.mul(
              nights
            );

          /*
           * Payment status can be changed.
           */
          const paymentStatus =
            parsed.data.paymentStatus ??
            reservation.paymentStatus;

          /*
           * IMPORTANT:
           *
           * Keep the existing status.
           *
           * If reservation is CHECKED_IN,
           * it stays CHECKED_IN.
           *
           * If reservation is CHECKED_OUT,
           * it stays CHECKED_OUT.
           *
           * If reservation is BOOKED,
           * it stays BOOKED.
           */
          const result =
            await tx.reservation.update({
              where: {
                id,
              },

              data: {
                checkInDate:
                  newCheckInDate,

                checkOutDate:
                  newCheckOutDate,

                status:
                  reservation.status,

                paymentStatus,

                pricePerNight,

                totalPrice,
              },

              include: {
                room: true,
                guest: true,
              },
            });

          /*
           * DO NOT change the room status here.
           *
           * Edit should not accidentally
           * change:
           *
           * OCCUPIED
           * NEEDS_CLEANING
           * CLEANING
           * OUT_OF_SERVICE
           * RESERVED
           *
           * Check-in and check-out endpoints
           * are responsible for room status.
           */

          /*
           * Audit log.
           */
          await writeAuditLog(
            tx,
            {
              hotelId:
                user.hotelId,

              userId:
                user.userId,

              action:
                "RESERVATION_UPDATED",

              entityType:
                "reservation",

              metadata: {
                reservationId:
                  id,

                status:
                  reservation.status,

                changes: {
                  checkInDate:
                    newCheckInDate,

                  checkOutDate:
                    newCheckOutDate,

                  paymentStatus,

                  pricePerNight,

                  totalPrice,
                },
              },
            }
          );

          return result;
        }
      );

    return Response.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

/*
 * --------------------------------------------------
 * DELETE RESERVATION
 * --------------------------------------------------
 *
 * Delete is allowed for:
 *
 * BOOKED
 * CHECKED_IN
 * CHECKED_OUT
 *
 */

export async function DELETE(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await params;

    const user = await requireAuth({
      roles: ["MANAGER", "RECEPTIONIST"],
    });

    if (!user) {
      throw new ApiError(
        "Unauthorized",
        401
      );
    }

    const reservation =
      await prisma.reservation.findFirst({
        where: {
          id,
          hotelId: user.hotelId,
        },
      });

    if (!reservation) {
      throw new ApiError(
        "Reservation not found",
        404
      );
    }

    /*
     * IMPORTANT:
     *
     * There is intentionally NO status
     * restriction here.
     *
     * BOOKED       -> can delete
     * CHECKED_IN   -> can delete
     * CHECKED_OUT  -> can delete
     */

    await prisma.$transaction(
      async (tx) => {
        /*
         * Delete reservation.
         */
        await tx.reservation.delete({
          where: {
            id,
          },
        });

        /*
         * Check whether another active
         * reservation is using this room.
         */
        const activeReservation =
          await tx.reservation.findFirst({
            where: {
              hotelId:
                user.hotelId,

              roomId:
                reservation.roomId,

              status: {
                in: [
                  "BOOKED",
                  "CHECKED_IN",
                ],
              },
            },
          });

        /*
         * Only release the room if
         * there is no other active
         * reservation.
         *
         * For a checked-out reservation,
         * this also prevents us from
         * incorrectly changing a room that
         * may currently be NEEDS_CLEANING.
         */
        if (
          !activeReservation &&
          reservation.status === "BOOKED"
        ) {
          await tx.room.update({
            where: {
              id: reservation.roomId,
            },

            data: {
              status: "AVAILABLE",
            },
          });
        }

        /*
         * Audit log.
         */
        await writeAuditLog(
          tx,
          {
            hotelId:
              user.hotelId,

            userId:
              user.userId,

            action:
              "RESERVATION_DELETED",

            entityType:
              "reservation",

            metadata: {
              reservationId:
                id,

              roomId:
                reservation.roomId,

              guestId:
                reservation.guestId,

              previousStatus:
                reservation.status,
            },
          }
        );
      }
    );

    return Response.json({
      message:
        "Reservation deleted successfully",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

