import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        hotelId: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        fullName: "asc",
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Failed to fetch users:", error);

    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}