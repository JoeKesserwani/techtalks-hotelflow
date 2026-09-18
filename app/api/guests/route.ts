import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const guests = await prisma.guest.findMany({
      orderBy: {
        fullName: "asc",
      },
    });

    return NextResponse.json(guests);
  } catch (error) {
    console.error("Failed to fetch guests:", error);

    return NextResponse.json(
      { error: "Failed to fetch guests" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { hotelId, fullName, phone, email } = body;

    if (!hotelId || !fullName) {
      return NextResponse.json(
        { error: "hotelId and fullName are required" },
        { status: 400 }
      );
    }

    const guest = await prisma.guest.create({
      data: {
        hotelId,
        fullName,
        phone: phone || null,
        email: email || null,
      },
    });

    return NextResponse.json(guest, { status: 201 });
  } catch (error) {
    console.error("Failed to create guest:", error);

    return NextResponse.json(
      { error: "Failed to create guest" },
      { status: 500 }
    );
  }
}