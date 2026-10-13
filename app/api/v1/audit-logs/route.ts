import { prisma } from "../../../../lib/db";
import { requireAuth } from "../../../../lib/middleware/requireAuth";
import { ApiError, handleRouteError } from "../../../../lib/api/errors";

type Meta = Record<string, unknown>;

const asMeta = (value: unknown): Meta =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Meta)
    : {};

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

function intParam(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/**
 * GET /api/v1/audit-logs
 *
 * Query params (all optional):
 *   page        1-based page number            (default 1)
 *   pageSize    rows per page, max 100         (default 20)
 *   entityType  reservation | room | guest | user | housekeeping_task | hotel
 *   search      matches the staff member's name
 *   from        ISO date-time; inclusive lower bound
 *   to          ISO date-time; exclusive upper bound
 *
 * Returns { items, total, page, pageSize }. Each item carries a `context`
 * object with human-readable names (room number, guest name, assignee...)
 * resolved from the IDs stored in metadata, so the UI never has to show raw IDs.
 * Names are resolved at read time, so they reflect the *current* name of an entity.
 */
export async function GET(req: Request) {
  try {
    const user = await requireAuth({ roles: ["MANAGER", "ADMIN"] });
    if (!user) throw new ApiError("Unauthorized", 401);

    const url = new URL(req.url);
    const page = intParam(url.searchParams.get("page"), 1, 1, 100_000);
    const pageSize = intParam(url.searchParams.get("pageSize"), 20, 1, 100);
    const entityType = url.searchParams.get("entityType") || undefined;
    const search = url.searchParams.get("search")?.trim() || undefined;
    const fromRaw = url.searchParams.get("from");
    const toRaw = url.searchParams.get("to");

    let from: Date | undefined;
    let to: Date | undefined;
    if (fromRaw) {
      from = new Date(fromRaw);
      if (Number.isNaN(from.getTime()))
        throw new ApiError('Invalid "from" date', 400);
    }
    if (toRaw) {
      to = new Date(toRaw);
      if (Number.isNaN(to.getTime()))
        throw new ApiError('Invalid "to" date', 400);
    }
    if (from && to && from >= to) {
      throw new ApiError('The "to" date must be after the "from" date', 400);
    }

    const where = {
      hotelId: user.hotelId,
      ...(entityType ? { entityType } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lt: to } : {}),
            },
          }
        : {}),
      ...(search ? { user: { fullName: { contains: search } } } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { fullName: true, role: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    // ---- Collect every ID referenced by this page of logs ----
    const reservationIds = new Set<string>();
    const taskIds = new Set<string>();
    const guestIds = new Set<string>();
    const roomIds = new Set<string>();
    const userIds = new Set<string>();

    for (const log of logs) {
      const meta = asMeta(log.metadataJson);
      const changes = asMeta(meta.changes);
      const add = (set: Set<string>, value: unknown) => {
        const id = asString(value);
        if (id) set.add(id);
      };
      add(reservationIds, meta.reservationId);
      add(taskIds, meta.taskId);
      add(guestIds, meta.guestId);
      add(roomIds, meta.roomId);
      add(userIds, meta.createdUserId);
      add(userIds, meta.targetUserId);
      add(userIds, meta.assignedToUserId);
      add(userIds, changes.assignedToUserId);
    }

    // ---- Resolve them in parallel (scoped to this hotel) ----
    const [reservations, tasks, guests, rooms, users] = await Promise.all([
      reservationIds.size
        ? prisma.reservation.findMany({
            where: { id: { in: [...reservationIds] }, hotelId: user.hotelId },
            select: {
              id: true,
              checkInDate: true,
              checkOutDate: true,
              room: { select: { roomNumber: true } },
              guest: { select: { fullName: true } },
            },
          })
        : [],
      taskIds.size
        ? prisma.housekeepingTask.findMany({
            where: { id: { in: [...taskIds] }, hotelId: user.hotelId },
            select: {
              id: true,
              room: { select: { roomNumber: true } },
              assignedTo: { select: { fullName: true } },
            },
          })
        : [],
      guestIds.size
        ? prisma.guest.findMany({
            where: { id: { in: [...guestIds] }, hotelId: user.hotelId },
            select: { id: true, fullName: true },
          })
        : [],
      roomIds.size
        ? prisma.room.findMany({
            where: { id: { in: [...roomIds] }, hotelId: user.hotelId },
            select: { id: true, roomNumber: true },
          })
        : [],
      userIds.size
        ? prisma.user.findMany({
            where: { id: { in: [...userIds] }, hotelId: user.hotelId },
            select: { id: true, fullName: true },
          })
        : [],
    ]);

    const reservationById = new Map(reservations.map((r) => [r.id, r]));
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const guestById = new Map(guests.map((g) => [g.id, g]));
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    const userById = new Map(users.map((u) => [u.id, u]));

    const items = logs.map((log) => {
      const meta = asMeta(log.metadataJson);
      const changes = asMeta(meta.changes);

      const reservation = reservationById.get(
        asString(meta.reservationId) ?? "",
      );
      const task = taskById.get(asString(meta.taskId) ?? "");
      const guest = guestById.get(asString(meta.guestId) ?? "");
      const room = roomById.get(asString(meta.roomId) ?? "");

      const targetUser = userById.get(
        asString(meta.createdUserId) ?? asString(meta.targetUserId) ?? "",
      );
      const assignee = userById.get(
        asString(meta.assignedToUserId) ??
          asString(changes.assignedToUserId) ??
          "",
      );

      return {
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        createdAt: log.createdAt,
        user: log.user, // { fullName, role } | null
        metadata: meta,
        context: {
          roomNumber:
            reservation?.room.roomNumber ??
            task?.room.roomNumber ??
            room?.roomNumber ??
            asString(meta.roomNumber),
          guestName: reservation?.guest.fullName ?? guest?.fullName,
          checkInDate: (reservation?.checkInDate ??
            asString(meta.checkInDate)) as Date | string | undefined,
          checkOutDate: (reservation?.checkOutDate ??
            asString(meta.checkOutDate)) as Date | string | undefined,
          targetUserName: targetUser?.fullName,
          assigneeName: task?.assignedTo.fullName ?? assignee?.fullName,
        },
      };
    });

    return Response.json({ items, total, page, pageSize });
  } catch (err) {
    return handleRouteError(err);
  }
}
