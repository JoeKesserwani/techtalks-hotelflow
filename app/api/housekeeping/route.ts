import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const tasks = await prisma.housekeepingTask.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Failed to fetch housekeeping tasks:", error);

    return NextResponse.json(
      { error: "Failed to fetch housekeeping tasks" },
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
      assignedToUserId,
      status,
      startedAt,
      completedAt,
      notes,
      photos,
    } = body;

    if (!hotelId || !roomId || !assignedToUserId) {
      return NextResponse.json(
        {
          error:
            "hotelId, roomId, and assignedToUserId are required",
        },
        { status: 400 }
      );
    }

    const task = await prisma.housekeepingTask.create({
      data: {
        hotelId,
        roomId,
        assignedToUserId,
        status: status || "PENDING",
        startedAt: startedAt ? new Date(startedAt) : null,
        completedAt: completedAt ? new Date(completedAt) : null,
        notes: notes || null,
        photos: photos || null,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Failed to create housekeeping task:", error);

    return NextResponse.json(
      { error: "Failed to create housekeeping task" },
      { status: 500 }
    );
  }
}