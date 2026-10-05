import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/middleware/requireAuth";

export async function GET() {
  try {
    const authUser = await requireAuth({
      roles: ["ADMIN", "MANAGER"],
    });

    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // -------------------------
    // Date boundaries
    // -------------------------

    const now = new Date();

    const lebanonDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Beirut",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    const startOfToday = new Date(`${lebanonDate}T00:00:00.000Z`);

    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);

    const startOfDayAfterTomorrow = new Date(startOfTomorrow);
    startOfDayAfterTomorrow.setUTCDate(
      startOfDayAfterTomorrow.getUTCDate() + 1,
    );

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setUTCDate(startOfYesterday.getUTCDate() - 1);

    // -------------------------
    // Dashboard database queries
    // -------------------------

    // These queries are independent from each other,
    // so run them in parallel instead of one after another.
    const dashboardStart = performance.now();

    const [
      totalRooms,
      occupiedRooms,
      arrivals,
      departures,
      awaitingApproval,
      housekeepingReview,
      allRooms,
    ] = await Promise.all([
      // -------------------------
      // Total Rooms
      // -------------------------

      prisma.room.count({
        where: {
          hotelId: authUser.hotelId,
        },
      }),

      // -------------------------
      // Occupied Rooms
      // -------------------------

      prisma.room.count({
        where: {
          hotelId: authUser.hotelId,
          status: "OCCUPIED",
        },
      }),

      // -------------------------
      // Arrivals Today
      // -------------------------

      prisma.reservation.count({
        where: {
          hotelId: authUser.hotelId,
          checkInDate: {
            gte: startOfToday,
            lt: startOfTomorrow,
          },
          status: "BOOKED",
        },
      }),

      // -------------------------
      // Departures Today
      // -------------------------

      prisma.reservation.count({
        where: {
          hotelId: authUser.hotelId,
          checkOutDate: {
            gte: startOfToday,
            lt: startOfTomorrow,
          },
          status: "CHECKED_IN",
        },
      }),

      // -------------------------
      // Awaiting Approval
      // -------------------------

      prisma.housekeepingTask.count({
        where: {
          hotelId: authUser.hotelId,
          status: "IN_REVIEW",
        },
      }),

      // -------------------------
      // Housekeeping Review
      // -------------------------

      prisma.housekeepingTask.findMany({
        where: {
          hotelId: authUser.hotelId,
          status: "IN_REVIEW",
        },
        include: {
          room: true,
          assignedTo: true,
        },
        orderBy: {
          completedAt: "desc",
        },
        take: 3,
      }),

      // -------------------------
      // Room Status
      // -------------------------

      prisma.room.findMany({
        where: {
          hotelId: authUser.hotelId,
        },

        select: {
          id: true,
          roomNumber: true,
          roomType: true,
          status: true,
          updatedAt: true,

          reservations: {
            where: {
              hotelId: authUser.hotelId,

              status: {
                in: ["BOOKED", "CHECKED_IN", "CHECKED_OUT"],
              },

              checkOutDate: {
                gte: startOfYesterday,
              },
            },

            select: {
              id: true,
              checkInDate: true,
              checkOutDate: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },

            orderBy: {
              updatedAt: "desc",
            },
          },
        },
      }),
    ]);
    console.log(
      `Dashboard DB queries: ${(performance.now() - dashboardStart).toFixed(0)}ms`,
    );
    // -------------------------
    // Occupancy
    // -------------------------

    const occupancy =
      totalRooms === 0 ? 0 : Math.round((occupiedRooms / totalRooms) * 100);

    // -------------------------
    // Room Priority Logic
    // -------------------------

    const rooms = allRooms
      .map((room) => {
        let priority = 99;
        let eventDate: Date | null = null;

        // -------------------------
        // 1. Current Room Status
        // -------------------------

        if (
          room.status === "CLEANING" ||
          room.status === "NEEDS_CLEANING" ||
          room.status === "IN_REVIEW"
        ) {
          priority = 1;
          eventDate = room.updatedAt;
        }

        // -------------------------
        // 2. Reservation Relevance
        // -------------------------

        for (const reservation of room.reservations) {
          const checkInToday =
            reservation.checkInDate >= startOfToday &&
            reservation.checkInDate < startOfTomorrow;

          const checkOutToday =
            reservation.checkOutDate >= startOfToday &&
            reservation.checkOutDate < startOfTomorrow;

          const currentlyStaying =
            reservation.status === "CHECKED_IN" &&
            reservation.checkInDate <= startOfToday &&
            reservation.checkOutDate > startOfToday;

          const checkInTomorrow =
            reservation.checkInDate >= startOfTomorrow &&
            reservation.checkInDate < startOfDayAfterTomorrow;

          const checkOutTomorrow =
            reservation.checkOutDate >= startOfTomorrow &&
            reservation.checkOutDate < startOfDayAfterTomorrow;

          // Check-in today
          if (checkInToday && priority > 2) {
            priority = 2;
            eventDate = reservation.updatedAt;
          }

          // Check-out today
          if (checkOutToday && priority > 3) {
            priority = 3;
            eventDate = reservation.updatedAt;
          }

          // Guest currently staying
          if (currentlyStaying && priority > 4) {
            priority = 4;
            eventDate = reservation.updatedAt;
          }

          // Check-in tomorrow
          if (checkInTomorrow && priority > 5) {
            priority = 5;
            eventDate = reservation.checkInDate;
          }

          // Check-out tomorrow
          if (checkOutTomorrow && priority > 6) {
            priority = 6;
            eventDate = reservation.checkOutDate;
          }

          // Future reservation
          if (
            reservation.status === "BOOKED" &&
            reservation.checkInDate >= startOfDayAfterTomorrow &&
            priority > 7
          ) {
            priority = 7;
            eventDate = reservation.checkInDate;
          }
        }

        return {
          id: room.id,
          roomNumber: room.roomNumber,
          roomType: room.roomType,
          status: room.status,
          updatedAt: room.updatedAt,
          priority,
          eventDate,
        };
      })

      // -------------------------
      // Sort rooms
      // -------------------------

      .sort((a, b) => {
        // First: priority
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }

        // Second: most recently changed
        if (a.eventDate && b.eventDate) {
          return b.eventDate.getTime() - a.eventDate.getTime();
        }

        // Third: room number
        return a.roomNumber.localeCompare(b.roomNumber, undefined, {
          numeric: true,
        });
      })

      // Show only the first 10 rooms
      .slice(0, 10)

      // Remove internal sorting fields
      .map(({ updatedAt, priority, eventDate, ...room }) => room);

    // -------------------------
    // API Response
    // -------------------------

    return NextResponse.json({
      occupancy,
      arrivals,
      departures,
      awaitingApproval,
      housekeepingReview,
      rooms,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);

    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
