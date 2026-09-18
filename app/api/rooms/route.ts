import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const rooms = await prisma.room.findMany({
      orderBy: {
        roomNumber: "asc",
      },
    });

    return NextResponse.json(rooms);
  } catch (error) {
    console.error("Failed to fetch rooms:", error);

    return NextResponse.json(
      { error: "Failed to fetch rooms" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { hotelId, roomNumber, roomType, basePrice } = body;

    if (!hotelId || !roomNumber || !roomType || basePrice === undefined) {
      return NextResponse.json(
        {
          error: "hotelId, roomNumber, roomType, and basePrice are required",
        },
        { status: 400 }
      );
    }

    const room = await prisma.room.create({
      data: {
        hotelId,
        roomNumber,
        roomType,
        basePrice,
      },
    });

    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error("Failed to create room:", error);

    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }
}