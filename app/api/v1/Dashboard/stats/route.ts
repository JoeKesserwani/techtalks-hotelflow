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
      roles: ["ADMIN"],
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
    const rooms = await prisma.room.findMany({
      where: {
        hotelId: authUser.hotelId,
      },
      select: {
        id: true,
        roomNumber: true,
        roomType: true,
        status: true,
      },
      orderBy: {
        roomNumber: "asc",
      },
    });

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
