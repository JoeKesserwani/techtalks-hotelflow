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
  roomLabel,
  shiftDate,
  todayInHotel,
  type Reservation,
  type Room,
} from "./frontdesk";
import { NewReservationDialog } from "../../../components/Reservations/newReservationDialog";
import { ReservationsBoard } from "../../../components/Reservations/reservationBoard";
import { RoomAvailabilityChart } from "../../../components/Reservations/RoomAvailabilityChart";
import Header from "../../../components/Header/Header";

export default function FrontDeskPage() {
  const [today] = useState(todayInHotel);
  const [date, setDate] = useState(today);
  const [items, setItems] = useState<Reservation[] | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
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
    void Promise.resolve().then(load);
  }, [date, load]);
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const day = useMemo(
    () => bucketDay(items ?? [], date, today),
    [items, date, today],
  );
  const isToday = date === today;
  const loading = items === null && !error;

  const merge = (u: Reservation) =>
    setItems((p) => p?.map((x) => (x.id === u.id ? u : x)) ?? p);

  return (
    <main className={`${s.page} ${t.tokens}`} aria-busy={loading}>
      <Header
        title="Reservations"
        subtitle="Arrivals, departures, and in-house guests"
        userSubtitle={formatDate(date, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      >
        <div className={s.nav}>
          <button
            className={s.arrow}
            onClick={() => setDate(shiftDate(date, -1))}
            aria-label="Previous day"
          >
            ‹
          </button>
          <span className={s.selectedDate} aria-live="polite">
            {formatDate(date, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </span>
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
      </Header>

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

      <RoomAvailabilityChart
        rooms={rooms}
        reservations={items ?? []}
        date={date}
        today={today}
        onSelectRoom={(roomId) => setBooking({ roomId })}
      />

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
