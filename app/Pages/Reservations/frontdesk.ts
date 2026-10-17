/*
 * Front-desk helpers.
 * All business dates are "YYYY-MM-DD" strings in the hotel's timezone,
 * matching how the reservation API stores them (UTC-midnight date-only values).
 */
export const HOTEL_TZ = "Asia/Beirut";

export interface Reservation {
  id: string;
  roomId: string;
  guestId: string;
  checkInDate: string;
  checkOutDate: string;
  pricePerNight: string | number;
  totalPrice: string | number;
  amountPaid?: string | number | null;
  status: "BOOKED" | "CHECKED_IN" | "CHECKED_OUT" | string;
  paymentStatus: string;
  room?: Room;
  guest?: Guest;
}

export interface Room {
  id: string;
  roomNumber: string;
  roomType?: string;
  floor?: number;
  capacity?: number;
  basePrice: string | number;
  status?: string;
}
export interface Guest {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
}

export const API = "/api/v1";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const request = () =>
    fetch(`${API}${path}`, {
      cache: "no-store",
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  let res = await request();

  if (res.status === 401) {
    const refreshResponse = await fetch(`${API}/auth/refresh`, {
      method: "POST",
      cache: "no-store",
    });
    if (refreshResponse.ok) res = await request();
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const b = await res.json();
      msg = b.error ?? b.message ?? msg;
    } catch {}
    throw new ApiError(msg, res.status);
  }
  return res.json();
}

export interface Day {
  arriving: Reservation[];
  departing: Reservation[];
  staying: Reservation[];
}

export const todayInHotel = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: HOTEL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

/** Reservation dates arrive as ISO strings at UTC midnight; the first 10 chars are the calendar date. */
export const dayOnly = (v: string) => String(v).slice(0, 10);

const toUtc = (d: string) => new Date(`${d}T00:00:00.000Z`);

export const shiftDate = (d: string, days: number) =>
  new Date(toUtc(d).getTime() + days * 864e5).toISOString().slice(0, 10);

export const nightsBetween = (a: string, b: string) =>
  Math.max(
    1,
    Math.round(
      (toUtc(dayOnly(b)).getTime() - toUtc(dayOnly(a)).getTime()) / 864e5,
    ),
  );

export const formatDate = (d: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts })
    .format(toUtc(d))
    .replace(/\bSep\b/, "Sept");

export const guestName = (r: Reservation) => r.guest?.fullName ?? "Guest";

export const roomLabel = (r: Reservation) =>
  r.room?.roomNumber ?? r.roomId.slice(0, 4);

export type PayKind = "paid" | "partial" | "unpaid";

export function payment(r: Reservation): { kind: PayKind; label: string } {
  const s = String(r.paymentStatus).toUpperCase();
  if (s.includes("PARTIAL")) return { kind: "partial", label: "Partial paid" };
  if (s.includes("PAID") && !s.includes("UN"))
    return { kind: "paid", label: "Paid" };
  return { kind: "unpaid", label: "Unpaid" };
}

export const money = (v: string | number) => {
  const n = Number(v);
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
};

export function paymentSummary(r: Reservation): string {
  const total = Number(r.totalPrice);
  const p = payment(r);

  if (r.amountPaid === null || r.amountPaid === undefined) {
    if (p.kind === "paid") return `Paid ${money(total)}`;
    if (p.kind === "unpaid") return `Unpaid · Due ${money(total)}`;
    return "Partial paid · Amount received not recorded";
  }

  const amountPaid = Math.max(0, Number(r.amountPaid));
  const due = Math.max(0, total - amountPaid);
  if (due === 0) return `Paid ${money(amountPaid)}`;
  if (amountPaid === 0) return `Unpaid · Due ${money(total)}`;
  return `Paid ${money(amountPaid)} · Due ${money(due)}`;
}

/**
 * Bucket every reservation for a selected date.
 * - Arriving:  check-in date is the selected date.
 * - Departing: check-out date is the selected date (or, today only, guests still in-house past their date).
 * - Staying:   in-house tonight. Past days include checked-out stays (history), future days include BOOKED (forecast).
 */
export function bucketDay(
  all: Reservation[],
  date: string,
  today: string,
): Day {
  const staysOn = (r: Reservation) =>
    dayOnly(r.checkInDate) <= date && date < dayOnly(r.checkOutDate);
  const stayStatuses =
    date < today
      ? ["CHECKED_IN", "CHECKED_OUT"]
      : date === today
        ? ["CHECKED_IN"]
        : ["BOOKED", "CHECKED_IN"];

  const arriving = all.filter(
    (r) => dayOnly(r.checkInDate) === date && r.status !== "CANCELLED",
  );

  const departing = all.filter((r) => {
    const out = dayOnly(r.checkOutDate);
    if (r.status === "CHECKED_OUT") return out === date;
    if (r.status === "CHECKED_IN")
      return out === date || (date === today && out < today);
    return r.status === "BOOKED" && date > today && out === date;
  });

  const staying = all.filter(
    (r) => stayStatuses.includes(r.status) && staysOn(r),
  );
  const byRoom = (a: Reservation, b: Reservation) =>
    roomLabel(a).localeCompare(roomLabel(b), undefined, { numeric: true });

  return {
    arriving: arriving.sort(byRoom),
    departing: departing.sort(byRoom),
    staying: staying.sort(byRoom),
  };
}

/* ---------- Conflict detection (mirrors the server's overlap rule: existing.in < new.out && existing.out > new.in) ---------- */
export const ACTIVE = ["BOOKED", "CHECKED_IN"];
const overlaps = (r: Reservation, inD: string, outD: string) =>
  dayOnly(r.checkInDate) < outD && dayOnly(r.checkOutDate) > inD;

export const findRoomConflict = (
  all: Reservation[],
  roomId: string,
  inD: string,
  outD: string,
  ignoreId?: string,
) =>
  all.find(
    (r) =>
      r.id !== ignoreId &&
      r.roomId === roomId &&
      ACTIVE.includes(r.status) &&
      overlaps(r, inD, outD),
  );

export const findGuestConflict = (
  all: Reservation[],
  guestId: string,
  inD: string,
  outD: string,
) =>
  all.find(
    (r) =>
      r.guestId === guestId &&
      ACTIVE.includes(r.status) &&
      overlaps(r, inD, outD),
  );

/* ---------- Room board for a date ---------- */
export type TileState =
  | "arriving"
  | "occupied"
  | "departing"
  | "needsCleaning"
  | "cleaning"
  | "inReview"
  | "oos"
  | "free";
export interface Tile {
  room: Room;
  state: TileState;
  guest?: string;
}

export function roomBoard(
  rooms: Room[],
  day: Day,
  date: string,
  today: string,
): Tile[] {
  const index = (l: Reservation[]) => new Map(l.map((r) => [r.roomId, r]));
  const arr = index(
    day.arriving.filter((r) => ["BOOKED", "CHECKED_IN"].includes(r.status)),
  );
  const stay = index(day.staying);
  const dep = index(
    day.departing.filter((r) => date !== today || r.status !== "CHECKED_OUT"),
  );
  return rooms
    .map((room): Tile => {
      const a = arr.get(room.id),
        s = stay.get(room.id),
        d = dep.get(room.id);

      if (room.status === "OUT_OF_SERVICE" && date >= today)
        return { room, state: "oos" };

      if (date === today) {
        if (room.status === "NEEDS_CLEANING")
          return { room, state: "needsCleaning" };
        if (room.status === "CLEANING") return { room, state: "cleaning" };
        if (room.status === "IN_REVIEW") return { room, state: "inReview" };
        if (d?.status === "CHECKED_IN")
          return { room, state: "departing", guest: guestName(d) };
        if (s) return { room, state: "occupied", guest: guestName(s) };
        if (room.status === "OCCUPIED") return { room, state: "occupied" };
        if (a) return { room, state: "arriving", guest: guestName(a) };
      }

      if (s) return { room, state: "occupied", guest: guestName(s) };
      if (a) return { room, state: "arriving", guest: guestName(a) };
      if (d) return { room, state: "departing", guest: guestName(d) };
      return { room, state: "free" };
    })
    .sort((x, y) =>
      x.room.roomNumber.localeCompare(y.room.roomNumber, undefined, {
        numeric: true,
      }),
    );
}
