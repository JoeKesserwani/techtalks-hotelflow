import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const reservations = await prisma.reservation.findMany({
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
      pricePerNight,
      totalPrice,
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
        pricePerNight,
        totalPrice,
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