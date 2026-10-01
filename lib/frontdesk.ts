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
  status: "BOOKED" | "CHECKED_IN" | "CHECKED_OUT" | string;
  paymentStatus: string;
  room?: {
    number?: string | number;
    roomNumber?: string | number;
    name?: string;
    status?: string;
  };
  guest?: {
    fullName?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
  };
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

export const guestName = (r: Reservation) =>
  r.guest?.fullName ??
  r.guest?.name ??
  ([r.guest?.firstName, r.guest?.lastName].filter(Boolean).join(" ") ||
    "Guest");

export const roomLabel = (r: Reservation) =>
  String(
    r.room?.number ??
      r.room?.roomNumber ??
      r.room?.name ??
      r.roomId.slice(0, 4),
  );

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
