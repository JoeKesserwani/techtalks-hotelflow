// import { NextResponse } from "next/server";
// import { prisma } from "@/lib/db";
// import { requireAuth } from "@/lib/middleware/requireAuth";

// export async function GET() {
//   try {
//     const authUser = await requireAuth({
//       roles: ["ADMIN"],
//     });

//     if (!authUser) {
//       return NextResponse.json(
//         { message: "Unauthorized" },
//         { status: 401 }
//       );
//     }

//     const totalRooms = await prisma.room.count({
//       where: {
//         hotelId: authUser.hotelId,
//       },
//     });

//     const occupiedRooms = await prisma.room.count({
//       where: {
//         hotelId: authUser.hotelId,
//         status: "OCCUPIED",
//       },
//     });

//     const occupancy =
//       totalRooms === 0
//         ? 0
//         : Math.round((occupiedRooms / totalRooms) * 100);

//     return NextResponse.json({
//       occupancy,
//     });
//   } catch (error) {
//     console.error("Dashboard stats error:", error);

//     return NextResponse.json(
//       { message: "Internal server error" },
//       { status: 500 }
//     );
//   }
// }

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/middleware/requireAuth";

export async function GET() {
  try {
    const authUser = await requireAuth({
      roles: ["ADMIN","MANAGER"],
    });

    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the current date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // -------------------------
    // Occupancy
    // -------------------------

    const totalRooms = await prisma.room.count({
      where: {
        hotelId: authUser.hotelId,
      },
    });

    const occupiedRooms = await prisma.room.count({
      where: {
        hotelId: authUser.hotelId,
        status: "OCCUPIED",
      },
    });

    const occupancy =
      totalRooms === 0 ? 0 : Math.round((occupiedRooms / totalRooms) * 100);

    // -------------------------
    // Arrivals Today
    // -------------------------

    const arrivals = await prisma.reservation.count({
      where: {
        hotelId: authUser.hotelId,
        checkInDate: today,
        status: "BOOKED",
      },
    });

    // -------------------------
    // Departures Today
    // -------------------------

    const departures = await prisma.reservation.count({
      where: {
        hotelId: authUser.hotelId,
        checkOutDate: today,
        status: "CHECKED_IN",
      },
    });

    //-------------------------
    //  AWAITING_APPROVAL
    //-------------------------
    const awaitingApproval = await prisma.housekeepingTask.count({
      where: {
        hotelId: authUser.hotelId,
        status: "IN_REVIEW",
      },
    });

    // -------------------------
    //housekeeping review tasks
    // -------------------------

    const housekeepingReview = await prisma.housekeepingTask.findMany({
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
    });
    const startOfToday = new Date(today);

const startOfTomorrow = new Date(startOfToday);
startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

const startOfDayAfterTomorrow = new Date(startOfTomorrow);
startOfDayAfterTomorrow.setDate(
  startOfDayAfterTomorrow.getDate() + 1
);

const startOfYesterday = new Date(startOfToday);
startOfYesterday.setDate(startOfYesterday.getDate() - 1);

// Get all rooms for this hotel.
// The room.status is the CURRENT status of the room.
const allRooms = await prisma.room.findMany({
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
});

const rooms = allRooms
  .map((room) => {
    let priority = 99;
    let eventDate: Date | null = null;

    /*
     * ------------------------------------------
     * 1. CURRENT ROOM STATUS / RECENT ACTIVITY
     * ------------------------------------------
     *
     * Rooms that require operational attention
     * should be considered first.
     */

    if (
      room.status === "CLEANING" ||
      room.status === "NEEDS_CLEANING" ||
      room.status === "IN_REVIEW"
    ) {
      priority = 1;
      eventDate = room.updatedAt;
    }

    /*
     * ------------------------------------------
     * 2. RESERVATION RELEVANCE
     * ------------------------------------------
     */

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

      /*
       * Check-in today
       */
      if (checkInToday && priority > 2) {
        priority = 2;
        eventDate = reservation.updatedAt;
      }

      /*
       * Check-out today
       */
      if (checkOutToday && priority > 3) {
        priority = 3;
        eventDate = reservation.updatedAt;
      }

      /*
       * Guest is currently staying
       */
      if (currentlyStaying && priority > 4) {
        priority = 4;
        eventDate = reservation.updatedAt;
      }

      /*
       * Check-in tomorrow
       */
      if (checkInTomorrow && priority > 5) {
        priority = 5;
        eventDate = reservation.checkInDate;
      }

      /*
       * Check-out tomorrow
       */
      if (checkOutTomorrow && priority > 6) {
        priority = 6;
        eventDate = reservation.checkOutDate;
      }

      /*
       * Future reservation
       */
      if (
        reservation.status === "BOOKED" &&
        reservation.checkInDate >= startOfDayAfterTomorrow &&
        priority > 7
      ) {
        priority = 7;
        eventDate = reservation.checkInDate;
      }
    }

    /*
     * ------------------------------------------
     * Return the information needed by frontend
     * ------------------------------------------
     */

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
  .sort((a, b) => {
    /*
     * First sort by importance.
     */
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }

    /*
     * If two rooms have the same priority,
     * show the most recently changed one first.
     */
    if (a.eventDate && b.eventDate) {
      return b.eventDate.getTime() - a.eventDate.getTime();
    }

    /*
     * Finally use room number.
     */
    return a.roomNumber.localeCompare(b.roomNumber, undefined, {
      numeric: true,
    });
  })
  .slice(0, 10)
  .map(({ updatedAt, priority, eventDate, ...room }) => room);
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
