import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/middleware/requireAuth";

export async function GET() {
  try {
    const authUser = await requireAuth({ roles: ["RECEPTIONIST"] });

    if (!authUser) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const hotelId = authUser.hotelId;
    const todayString = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Beirut",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const startOfToday = new Date(`${todayString}T00:00:00.000Z`);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);

    const [reservations, rooms, housekeepingAttention] = await Promise.all([
        prisma.reservation.findMany({
          where: {
            hotelId,
            OR: [
              {
                checkInDate: {
                  gte: startOfToday,
                  lt: startOfTomorrow,
                },
              },
              {
                checkOutDate: {
                  gte: startOfToday,
                  lt: startOfTomorrow,
                },
              },
              {
                checkInDate: { lt: startOfToday },
                checkOutDate: { gt: startOfToday },
              },
            ],
          },
          select: {
            id: true,
            roomId: true,
            guestId: true,
            checkInDate: true,
            checkOutDate: true,
            pricePerNight: true,
            totalPrice: true,
            status: true,
            paymentStatus: true,
            guest: {
              select: {
                id: true,
                fullName: true,
                phone: true,
                email: true,
              },
            },
            room: {
              select: {
                id: true,
                roomNumber: true,
                roomType: true,
                floor: true,
                capacity: true,
                basePrice: true,
                status: true,
              },
            },
          },
        }),
        prisma.room.findMany({
          where: { hotelId },
          select: {
            id: true,
            roomNumber: true,
            roomType: true,
            floor: true,
            capacity: true,
            basePrice: true,
            status: true,
          },
          orderBy: { roomNumber: "asc" },
        }),
        prisma.housekeepingTask.findMany({
          where: {
            hotelId,
            status: { in: ["IN_REVIEW", "PENDING", "IN_PROGRESS"] },
          },
          include: {
            room: {
              select: {
                id: true,
                roomNumber: true,
                roomType: true,
                status: true,
              },
            },
            photoFiles: {
              select: {
                id: true,
              },
              orderBy: {
                createdAt: "asc",
              },
            },
            assignedTo: {
              select: {
                id: true,
                fullName: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
      ]);

    const roomStatus = {
      available: 0,
      reserved: 0,
      occupied: 0,
      inReview: 0,
      needsCleaning: 0,
      cleaning: 0,
      outOfService: 0,
    };

    for (const room of rooms) {
      switch (room.status) {
        case "AVAILABLE":
          roomStatus.available += 1;
          break;
        case "RESERVED":
          roomStatus.reserved += 1;
          break;
        case "OCCUPIED":
          roomStatus.occupied += 1;
          break;
        case "IN_REVIEW":
          roomStatus.inReview += 1;
          break;
        case "NEEDS_CLEANING":
          roomStatus.needsCleaning += 1;
          break;
        case "CLEANING":
          roomStatus.cleaning += 1;
          break;
        case "OUT_OF_SERVICE":
          roomStatus.outOfService += 1;
          break;
      }
    }

    const arrivals = reservations
      .filter(
        (reservation) =>
          reservation.status === "BOOKED" &&
          reservation.checkInDate >= startOfToday &&
          reservation.checkInDate < startOfTomorrow,
      )
      .sort(
        (a, b) => a.checkInDate.getTime() - b.checkInDate.getTime(),
      );
    const departures = reservations
      .filter(
        (reservation) =>
          reservation.status === "CHECKED_IN" &&
          reservation.checkOutDate >= startOfToday &&
          reservation.checkOutDate < startOfTomorrow,
      )
      .sort(
        (a, b) => a.checkOutDate.getTime() - b.checkOutDate.getTime(),
      );

    return NextResponse.json({
      success: true,
      summary: {
        arrivalsToday: arrivals.length,
        departuresToday: departures.length,
        availableRooms: roomStatus.available,
      },
      roomStatus,
      arrivals,
      departures,
      housekeepingAttention,
      reservations,
      rooms,
    });
  } catch (error) {
    console.error("Receptionist dashboard error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load receptionist dashboard data.",
      },
      { status: 500 },
    );
  }
}
