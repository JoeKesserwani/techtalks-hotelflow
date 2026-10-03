import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/middleware/requireAuth";

export async function GET() {
try {
// Only authenticated receptionists can access this dashboard.
const authUser = await requireAuth({
roles: ["RECEPTIONIST"],
});

if (!authUser) {
  return NextResponse.json(
    {
      success: false,
      message: "Unauthorized",
    },
    { status: 401 }
  );
}

const hotelId = authUser.hotelId;


const todayString = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Beirut",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

// Today's calendar date at UTC midnight.
const startOfToday = new Date(`${todayString}T00:00:00.000Z`);

// Tomorrow's calendar date at UTC midnight.
const startOfTomorrow = new Date(startOfToday);
startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);

console.log("Receptionist dashboard date:", {
  todayString,
  startOfToday: startOfToday.toISOString(),
  startOfTomorrow: startOfTomorrow.toISOString(),
});

/*
 * Run independent database queries together.
 */
const [
  arrivalsToday,
  departuresToday,
  availableRooms,
  roomStatusCounts,
  arrivals,
  departures,
  housekeepingAttention,
] = await Promise.all([
  // -----------------------------
  // ARRIVALS TODAY
  // -----------------------------
  prisma.reservation.count({
    where: {
      hotelId,
      checkInDate: {
        gte: startOfToday,
        lt: startOfTomorrow,
      },
      status: "BOOKED",
    },
  }),

  // -----------------------------
  // DEPARTURES TODAY
  // -----------------------------
  prisma.reservation.count({
    where: {
      hotelId,
      checkOutDate: {
        gte: startOfToday,
        lt: startOfTomorrow,
      },
      status: "CHECKED_IN",
    },
  }),

  // -----------------------------
  // AVAILABLE ROOMS
  // -----------------------------
  prisma.room.count({
    where: {
      hotelId,
      status: "AVAILABLE",
    },
  }),

  // -----------------------------
  // ROOM STATUS COUNTS
  // -----------------------------
  prisma.room.groupBy({
    by: ["status"],
    where: {
      hotelId,
    },
    _count: {
      status: true,
    },
  }),

  // -----------------------------
  // TODAY'S ARRIVALS
  // -----------------------------
  prisma.reservation.findMany({
    where: {
      hotelId,
      checkInDate: {
        gte: startOfToday,
        lt: startOfTomorrow,
      },
      status: "BOOKED",
    },
    include: {
      guest: {
        select: {
          id: true,
          fullName: true,
          phone: true,
        },
      },
      room: {
        select: {
          id: true,
          roomNumber: true,
          roomType: true,
        },
      },
    },
    orderBy: {
      checkInDate: "asc",
    },
  }),

  // -----------------------------
  // TODAY'S DEPARTURES
  // -----------------------------
  prisma.reservation.findMany({
    where: {
      hotelId,
      checkOutDate: {
        gte: startOfToday,
        lt: startOfTomorrow,
      },
      status: "CHECKED_IN",
    },
    include: {
      guest: {
        select: {
          id: true,
          fullName: true,
          phone: true,
        },
      },
      room: {
        select: {
          id: true,
          roomNumber: true,
          roomType: true,
        },
      },
    },
    orderBy: {
      checkOutDate: "asc",
    },
  }),

  // -----------------------------
  // HOUSEKEEPING ATTENTION
  // -----------------------------
  prisma.housekeepingTask.findMany({
    where: {
      hotelId,
      status: {
        in: ["IN_REVIEW", "PENDING", "IN_PROGRESS"],
      },
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
      assignedTo: {
        select: {
          id: true,
          fullName: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  }),
]);

// -----------------------------
// ROOM STATUS OBJECT
// -----------------------------

const roomStatus = {
  available: 0,
  reserved: 0,
  occupied: 0,
  inReview: 0,
  needsCleaning: 0,
  cleaning: 0,
  outOfService: 0,
};

for (const item of roomStatusCounts) {
  switch (item.status) {
    case "AVAILABLE":
      roomStatus.available = item._count.status;
      break;

    case "RESERVED":
      roomStatus.reserved = item._count.status;
      break;

    case "OCCUPIED":
      roomStatus.occupied = item._count.status;
      break;

    case "IN_REVIEW":
      roomStatus.inReview = item._count.status;
      break;

    case "NEEDS_CLEANING":
      roomStatus.needsCleaning = item._count.status;
      break;

    case "CLEANING":
      roomStatus.cleaning = item._count.status;
      break;

    case "OUT_OF_SERVICE":
      roomStatus.outOfService = item._count.status;
      break;
  }
}

return NextResponse.json({
  success: true,

  summary: {
    arrivalsToday,
    departuresToday,
    availableRooms,
  },

  roomStatus,

  arrivals,

  departures,

  housekeepingAttention,
});

} catch (error) {
console.error("Receptionist dashboard error:", error);

return NextResponse.json(
  {
    success: false,
    message: "Failed to load receptionist dashboard data.",
  },
  { status: 500 }
);
}
}
