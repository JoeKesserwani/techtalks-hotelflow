import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/middleware/requireAuth";

const DAY_IN_MS = 86_400_000;
const MAX_DATE_RANGE_DAYS = 366;

function parseDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return date;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function countByStatus<T extends { status: string }>(
  items: T[],
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const item of items) {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
  }

  return counts;
}

export async function GET(request: Request) {
  try {
    const authUser = await requireAuth({
      roles: ["ADMIN", "MANAGER"],
    });

    if (!authUser) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);

    const startParam = searchParams.get("startDate");
    const endParam = searchParams.get("endDate");

    const parsedStart = parseDate(startParam);
    const parsedEnd = parseDate(endParam);

    if (startParam && !parsedStart) {
      return NextResponse.json(
        {
          message:
            "Invalid startDate. Use a valid date in YYYY-MM-DD format.",
        },
        { status: 400 },
      );
    }

    if (endParam && !parsedEnd) {
      return NextResponse.json(
        {
          message:
            "Invalid endDate. Use a valid date in YYYY-MM-DD format.",
        },
        { status: 400 },
      );
    }

    const today = new Date();
    const defaultEnd = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
      ),
    );
    const defaultStart = addDays(defaultEnd, -29);

    const startDate = parsedStart ?? defaultStart;
    const endDate = parsedEnd ?? defaultEnd;

    if (startDate > endDate) {
      return NextResponse.json(
        {
          message:
            "startDate must be before or equal to endDate.",
        },
        { status: 400 },
      );
    }

    const dayCount =
      Math.floor(
        (endDate.getTime() - startDate.getTime()) / DAY_IN_MS,
      ) + 1;

    if (dayCount > MAX_DATE_RANGE_DAYS) {
      return NextResponse.json(
        {
          message: "Please select a date range of 366 days or less.",
        },
        { status: 400 },
      );
    }

    const endExclusive = addDays(endDate, 1);
    const hotelId = authUser.hotelId;

    const [
      rooms,
      reservationsCreated,
      reservationsOverlapping,
      tasksCreated,
      tasksCompleted,
    ] = await Promise.all([
      // Current room inventory and statuses for this hotel.
      prisma.room.findMany({
        where: { hotelId },
        select: {
          id: true,
          status: true,
        },
      }),

      // Reservations created during the selected period.
      prisma.reservation.findMany({
        where: {
          hotelId,
          createdAt: {
            gte: startDate,
            lt: endExclusive,
          },
        },
        select: {
          id: true,
          createdAt: true,
          totalPrice: true,
          paymentStatus: true,
          status: true,
        },
      }),

      // Non-cancelled reservations overlapping each selected date.
      prisma.reservation.findMany({
        where: {
          hotelId,
          status: {
            notIn: ["CANCELLED", "NO_SHOW"],
          },
          checkInDate: {
            lt: endExclusive,
          },
          checkOutDate: {
            gt: startDate,
          },
        },
        select: {
          roomId: true,
          checkInDate: true,
          checkOutDate: true,
        },
      }),

      // Housekeeping tasks created during the selected period.
      prisma.housekeepingTask.findMany({
        where: {
          hotelId,
          createdAt: {
            gte: startDate,
            lt: endExclusive,
          },
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
        },
      }),

      // Tasks completed during the selected period.
      prisma.housekeepingTask.findMany({
        where: {
          hotelId,
          status: "DONE",
          completedAt: {
            gte: startDate,
            lt: endExclusive,
          },
        },
        select: {
          id: true,
          completedAt: true,
        },
      }),
    ]);

    // Current room occupancy and availability.
    const totalRooms = rooms.length;

    const occupiedRooms = rooms.filter(
      (room) => room.status === "OCCUPIED",
    ).length;

    const roomStatusCounts: Record<string, number> = {};

    for (const room of rooms) {
      roomStatusCounts[room.status] =
        (roomStatusCounts[room.status] ?? 0) + 1;
    }

    // Daily trends for the selected date range.
    const daily = Array.from({ length: dayCount }, (_, index) => {
      const date = addDays(startDate, index);
      const key = dateKey(date);
      const nextDate = addDays(date, 1);

      const dailyReservations = reservationsCreated.filter(
        (reservation) =>
          dateKey(reservation.createdAt) === key,
      );

      const dailyCompletedTasks = tasksCompleted.filter(
        (task) =>
          task.completedAt !== null &&
          dateKey(task.completedAt) === key,
      );

      const scheduledRoomIds = new Set(
        reservationsOverlapping
          .filter(
            (reservation) =>
              reservation.checkInDate < nextDate &&
              reservation.checkOutDate > date,
          )
          .map((reservation) => reservation.roomId),
      );

      const reservationValue = dailyReservations.reduce(
        (sum, reservation) =>
          sum + Number(reservation.totalPrice),
        0,
      );

      const paidReservationValue = dailyReservations
        .filter(
          (reservation) => reservation.paymentStatus === "PAID",
        )
        .reduce(
          (sum, reservation) =>
            sum + Number(reservation.totalPrice),
          0,
        );

      return {
        date: key,
        reservations: dailyReservations.length,
        reservationValue,
        paidReservationValue,
        scheduledOccupancy: totalRooms
          ? Math.round(
              (scheduledRoomIds.size / totalRooms) * 100,
            )
          : 0,
        housekeepingCompleted: dailyCompletedTasks.length,
      };
    });

    // Reservation values for reservations created in this period.
    const totalReservationValue = reservationsCreated.reduce(
      (sum, reservation) =>
        sum + Number(reservation.totalPrice),
      0,
    );

    const paidReservationValue = reservationsCreated
      .filter(
        (reservation) => reservation.paymentStatus === "PAID",
      )
      .reduce(
        (sum, reservation) =>
          sum + Number(reservation.totalPrice),
        0,
      );

    const reservationStatuses = countByStatus(
      reservationsCreated,
    );

    const housekeepingStatuses = countByStatus(tasksCreated);

    // Completion rate uses tasks created in this period as its denominator.
    const completedCreatedTasks = tasksCreated.filter(
      (task) => task.status === "DONE",
    ).length;

    const housekeepingCompletionRate = tasksCreated.length
      ? Math.round(
          (completedCreatedTasks / tasksCreated.length) * 100,
        )
      : 0;

    return NextResponse.json({
      range: {
        startDate: dateKey(startDate),
        endDate: dateKey(endDate),
      },

      overview: {
        totalRooms,
        occupiedRooms,
        currentOccupancy: totalRooms
          ? Math.round((occupiedRooms / totalRooms) * 100)
          : 0,
        availableRooms: roomStatusCounts["AVAILABLE"] ?? 0,

        reservations: reservationsCreated.length,
        totalReservationValue,
        paidReservationValue,

        housekeepingCreated: tasksCreated.length,
        housekeepingCompleted: tasksCompleted.length,
        housekeepingCompletionRate,
      },

      roomStatusCounts,
      reservationStatuses,
      housekeepingStatuses,
      daily,
    });
  } catch (error) {
    console.error("Statistics API error:", error);

    return NextResponse.json(
      { message: "Unable to load hotel statistics." },
      { status: 500 },
    );
  }
}