import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const reservations = await prisma.reservation.findMany({
      include: {
        guest: true,
        room: true,
      },
      orderBy: {
        checkInDate: "asc",
      },
    });

    return NextResponse.json(reservations);
  } catch (error) {
    console.error("Failed to fetch reservations:", error);

    return NextResponse.json(
      { error: "Failed to fetch reservations" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      hotelId,
      roomId,
      guestId,
      createdByUserId,
      checkInDate,
      checkOutDate,
      status,
      pricePerNight,
      totalPrice,
      paymentStatus,
    } = body;

    if (
      !hotelId ||
      !roomId ||
      !guestId ||
      !createdByUserId ||
      !checkInDate ||
      !checkOutDate ||
      pricePerNight === undefined ||
      totalPrice === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "hotelId, roomId, guestId, createdByUserId, checkInDate, checkOutDate, pricePerNight, and totalPrice are required",
        },
        { status: 400 }
      );
    }

    const reservation = await prisma.reservation.create({
      data: {
        hotelId,
        roomId,
        guestId,
        createdByUserId,
        checkInDate: new Date(checkInDate),
        checkOutDate: new Date(checkOutDate),
        status: status || "BOOKED",
        pricePerNight,
        totalPrice,
        paymentStatus: paymentStatus || "UNPAID",
      },
      include: {
        guest: true,
        room: true,
      },
    });

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    console.error("Failed to create reservation:", error);

    return NextResponse.json(
      { error: "Failed to create reservation" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const {
      id,
      checkInDate,
      checkOutDate,
      status,
      pricePerNight,
      totalPrice,
      paymentStatus,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Reservation id is required" },
        { status: 400 }
      );
    }

    const reservation = await prisma.reservation.update({
      where: {
        id,
      },
      data: {
        ...(checkInDate && {
          checkInDate: new Date(checkInDate),
        }),

        ...(checkOutDate && {
          checkOutDate: new Date(checkOutDate),
        }),

        ...(status && {
          status,
        }),

        ...(pricePerNight !== undefined && {
          pricePerNight,
        }),

        ...(totalPrice !== undefined && {
          totalPrice,
        }),

        ...(paymentStatus && {
          paymentStatus,
        }),
      },

      include: {
        guest: true,
        room: true,
      },
    });

    return NextResponse.json(reservation);
  } catch (error) {
    console.error("Failed to update reservation:", error);

    return NextResponse.json(
      { error: "Failed to update reservation" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Reservation id is required" },
        { status: 400 }
      );
    }

    await prisma.reservation.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      message: "Reservation deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete reservation:", error);

    return NextResponse.json(
      { error: "Failed to delete reservation" },
      { status: 500 }
    );
  }
}