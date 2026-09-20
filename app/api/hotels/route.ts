import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const hotels = await prisma.hotel.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(hotels);
  } catch (error) {
    console.error("Failed to fetch hotels:", error);

    return NextResponse.json(
      { error: "Failed to fetch hotels" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { name, timezone, currency } = body;

    if (!name || !timezone || !currency) {
      return NextResponse.json(
        {
          error: "name, timezone, and currency are required",
        },
        { status: 400 }
      );
    }

    const hotel = await prisma.hotel.create({
      data: {
        name,
        timezone,
        currency,
      },
    });

    return NextResponse.json(hotel, { status: 201 });
  } catch (error) {
    console.error("Failed to create hotel:", error);

    return NextResponse.json(
      { error: "Failed to create hotel" },
      { status: 500 }
    );
  }
}