"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import s from "./page.module.css";
import t from "../../../components/Reservations/tokens.module.css";
import {
  ApiError,
  api,
  bucketDay,
  dayOnly,
  formatDate,
  guestName,
  roomBoard,
  roomLabel,
  shiftDate,
  todayInHotel,
  type Reservation,
  type Room,
  type TileState,
} from "./frontdesk";
import { NewReservationDialog } from "../../../components/Reservations/newReservationDialog";
import { ReservationsBoard } from "../../../components/Reservations/reservationBoard";

const titleCase = (v: string) => v.charAt(0) + v.slice(1).toLowerCase();

const LEGEND: Record<TileState, string> = {
  free: "Free",
  arriving: "Arriving",
  occupied: "Occupied",
  departing: "Leaves today",
  dirty: "Being cleaned",
  oos: "Out of service",
};

export default function FrontDeskPage() {
  const [today] = useState(todayInHotel);
  const [date, setDate] = useState(today);
  const [items, setItems] = useState<Reservation[] | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [me, setMe] = useState<{ fullName: string; role: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [booking, setBooking] = useState<{ roomId?: string } | null>(null);

  /* List endpoints have no date filter: refetch on every date change and on focus, filter client-side. */
  const load = useCallback(async () => {
    try {
      const [res, rms] = await Promise.all([
        api<Reservation[]>("/reservations"),
        api<Room[]>("/rooms"),
      ]);
      setItems(res);
      setRooms(rms);
      setError(null);
      setExpired(false);
    } catch (e) {
      if ((e as ApiError).status === 401) {
        setExpired(true);
        setError("Your session has expired. Sign in again to continue.");
      } else setError((e as Error).message || "Couldn't load reservations.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [date, load]);
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);
  useEffect(() => {
    api<{ user: { fullName: string; role: string } }>("/auth/me")
      .then((d) => setMe(d.user))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const day = useMemo(
    () => bucketDay(items ?? [], date, today),
    [items, date, today],
  );
  const board = useMemo(
    () => roomBoard(rooms, day, date, today),
    [rooms, day, date, today],
  );
  const isToday = date === today;
  const loading = items === null && !error;
  const free = board.filter((t) => t.state === "free").length;
  const tonight = board.filter((t) =>
    ["arriving", "occupied"].includes(t.state),
  ).length;
  const pct = rooms.length ? Math.round((tonight / rooms.length) * 100) : 0;

  const merge = (u: Reservation) =>
    setItems((p) => p?.map((x) => (x.id === u.id ? u : x)) ?? p);

  const name = me?.fullName ?? "";
  const initials =
    name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "–";

  return (
    <main className={`${s.page} ${t.tokens}`} aria-busy={loading}>
      <header className={s.header}>
        <div>
          <div className={s.nav}>
            <button
              className={s.arrow}
              onClick={() => setDate(shiftDate(date, -1))}
              aria-label="Previous day"
            >
              ‹
            </button>
            <h1>
              {formatDate(date, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </h1>
            <button
              className={s.arrow}
              onClick={() => setDate(shiftDate(date, 1))}
              aria-label="Next day"
            >
              ›
            </button>
            {!isToday && (
              <button className={s.ghost} onClick={() => setDate(today)}>
                Today
              </button>
            )}
            <input
              className={s.picker}
              type="date"
              value={date}
              aria-label="Jump to date"
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </div>
          <p className={s.sub}>
            {isToday ? "Today's" : "Day's"} arrivals, departures, and in-house
            guests
          </p>
        </div>
        <div className={s.staff}>
          <span className={s.avatar} aria-hidden>
            {initials}
          </span>
          <div>
            <strong>{name || "…"}</strong>
            <span>{me ? titleCase(me.role) : ""}</span>
          </div>
        </div>
      </header>

      {error && (
        <div className={s.error} role="alert">
          <span>{error}</span>
          {expired ? (
            <a href="/login">Sign in</a>
          ) : (
            <button onClick={load}>Retry</button>
          )}
        </div>
      )}

      <div className={s.summaryBar}>
        <p className={s.summary} aria-live="polite">
          <i aria-hidden />
          <b>{day.arriving.length}</b>{" "}
          {day.arriving.length === 1 ? "arrival" : "arrivals"} ·{" "}
          <b>{day.departing.length}</b>{" "}
          {day.departing.length === 1 ? "departure" : "departures"} ·{" "}
          <b>{day.staying.length}</b> rooms occupied
          {rooms.length ? ` of ${rooms.length}` : ""}
        </p>
        <button
          className={s.primary}
          onClick={() => setBooking({})}
          disabled={!rooms.length}
        >
          + New reservation
        </button>
      </div>

      <ReservationsBoard
        date={date}
        today={today}
        items={items}
        rooms={rooms}
        loading={loading}
        onUpdate={merge}
        onRemove={(id) => setItems((p) => p?.filter((x) => x.id !== id) ?? p)}
        onReload={load}
        onToast={setToast}
      />

      <section className={s.card} aria-labelledby="rooms-h">
        <div className={s.cardHead}>
          <div>
            <h2 id="rooms-h">Room availability</h2>
            <p className={s.hint}>
              {rooms.length
                ? `${pct}% occupied tonight · tap a free room to book it for ${formatDate(date < today ? today : date, { month: "short", day: "numeric" })}`
                : "Loading rooms…"}
            </p>
          </div>
          <span className={`${s.badge} ${s.ink}`}>{free} free</span>
        </div>
        <ul className={s.legend}>
          {(Object.keys(LEGEND) as TileState[]).map((k) => (
            <li key={k}>
              <i className={`${s.dot} ${s[`t_${k}`]}`} />
              {LEGEND[k]}
            </li>
          ))}
        </ul>
        <ul className={s.tiles}>
          {board.map(({ room, state, guest }) => (
            <li key={room.id}>
              <button
                className={`${s.tile} ${s[`t_${state}`]}`}
                disabled={state !== "free" || date < today}
                onClick={() => setBooking({ roomId: room.id })}
                aria-label={`Room ${room.roomNumber}, ${LEGEND[state]}${guest ? `, ${guest}` : ""}`}
              >
                <strong>{room.roomNumber}</strong>
                <span>{guest ?? room.roomType ?? LEGEND[state]}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {booking && (
        <NewReservationDialog
          defaultDate={date}
          today={today}
          rooms={rooms}
          reservations={items ?? []}
          initialRoomId={booking.roomId}
          onClose={() => setBooking(null)}
          onConflict={load}
          onCreated={(r) => {
            setItems((p) => [r, ...(p ?? [])]);
            setDate(dayOnly(r.checkInDate)); // jump to the booking's arrival day
            setToast(
              `Reservation created for ${guestName(r)} · Room ${roomLabel(r)}.`,
            );
          }}
        />
      )}

      <div className={s.toast} role="status" aria-live="polite">
        {toast}
      </div>
    </main>
  );
}
