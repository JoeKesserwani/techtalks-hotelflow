"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import s from "./page.module.css";
import {
  ApiError,
  api,
  bucketDay,
  dayOnly,
  formatDate,
  guestName,
  money,
  nightsBetween,
  payment,
  roomBoard,
  roomLabel,
  shiftDate,
  todayInHotel,
  type Reservation,
  type Room,
  type TileState,
} from "./frontdesk";
import { ConfirmCheckout, NewReservationDialog } from "./dialogs";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
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
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [confirm, setConfirm] = useState<Reservation | null>(null);
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
  useEffect(() => setShowAll(false), [date]);
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

  async function run(
    r: Reservation,
    path: string,
    init: RequestInit,
    message: string,
  ) {
    setBusy(r.id);
    try {
      merge(await api<Reservation>(`/reservations/${r.id}/${path}`, init));
      setToast(message);
      return true;
    } catch (e) {
      setToast((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }
  const checkIn = (r: Reservation) =>
    run(r, "check-in", { method: "POST" }, `${guestName(r)} checked in.`);
  const checkOut = (r: Reservation) =>
    run(r, "check-out", { method: "POST" }, `${guestName(r)} checked out.`);
  const markPaid = (r: Reservation) =>
    run(
      r,
      "payment",
      { method: "PATCH", body: JSON.stringify({ paymentStatus: "PAID" }) },
      `${guestName(r)} marked as paid.`,
    );

  /** Paid reservations check out straight away; anything else asks first. */
  const requestCheckout = (r: Reservation) =>
    payment(r).kind === "paid" ? checkOut(r) : setConfirm(r);

  const btn = (r: Reservation, label: string, fn: () => void) => (
    <button
      className={s.primary}
      disabled={busy === r.id}
      onClick={fn}
      aria-label={`${label} ${guestName(r)}`}
    >
      {busy === r.id ? "Working…" : label}
    </button>
  );
  const paidBtn = (r: Reservation) =>
    payment(r).kind === "paid" ? null : (
      <button
        className={s.pay}
        disabled={busy === r.id}
        onClick={() => markPaid(r)}
        aria-label={`Mark ${guestName(r)} as paid`}
      >
        Paid
      </button>
    );

  const visibleStaying = showAll ? day.staying : day.staying.slice(0, 2);
  const hidden = day.staying.length - 2;
  const name = me?.fullName ?? "";
  const initials =
    name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "–";

  return (
    <main className={s.page} aria-busy={loading}>
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
            <a href="/">Sign in</a>
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

      <section className={s.board}>
        <Column
          title="Arriving"
          count={day.arriving.length}
          tone={s.slate}
          loading={loading}
          empty="No arrivals on this date."
        >
          {day.arriving.map((r) => (
            <Row
              key={r.id}
              name={guestName(r)}
              meta={`Room ${roomLabel(r)} · ${plural(nightsBetween(r.checkInDate, r.checkOutDate), "night")} · ${payment(r).label}`}
            >
              {paidBtn(r)}
              {r.status === "BOOKED" ? (
                isToday ? (
                  btn(r, "Check in", () => checkIn(r))
                ) : (
                  <span className={s.note}>
                    {date < today ? "Did not arrive" : "Expected"}
                  </span>
                )
              ) : (
                <span className={s.note}>Checked in</span>
              )}
            </Row>
          ))}
        </Column>

        <Column
          title="Departing"
          count={day.departing.length}
          tone={s.clay}
          loading={loading}
          empty="No departures on this date."
        >
          {day.departing.map((r) => {
            const p = payment(r);
            return (
              <Row
                key={r.id}
                name={guestName(r)}
                meta={`Room ${roomLabel(r)} · ${p.kind === "unpaid" ? `Unpaid ${money(r.totalPrice)}` : p.label}`}
              >
                {paidBtn(r)}
                {r.status === "CHECKED_IN" && isToday ? (
                  btn(r, "Check out", () => requestCheckout(r))
                ) : (
                  <span className={s.note}>
                    {r.status === "CHECKED_OUT" ? "Checked out" : "Due out"}
                  </span>
                )}
              </Row>
            );
          })}
        </Column>

        <Column
          title="Staying tonight"
          count={day.staying.length}
          tone={s.olive}
          loading={loading}
          wide
          empty="No in-house guests."
        >
          {visibleStaying.map((r) => (
            <Row
              key={r.id}
              name={guestName(r)}
              meta={`Room ${roomLabel(r)} · until ${formatDate(dayOnly(r.checkOutDate), { month: "short", day: "numeric" })}`}
            >
              {paidBtn(r)}
              <span className={s.note}>{payment(r).label}</span>
            </Row>
          ))}
          {hidden > 0 && (
            <Row
              name={
                showAll
                  ? "Showing full house"
                  : `+ ${plural(hidden, "more guest")}`
              }
              meta={showAll ? "All in-house guests" : "See full house list"}
            >
              <button
                className={s.soft}
                onClick={() => setShowAll(!showAll)}
                aria-expanded={showAll}
              >
                {showAll ? "Show less" : "View all"}
              </button>
            </Row>
          )}
        </Column>
      </section>

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

      {confirm && (
        <ConfirmCheckout
          r={confirm}
          busy={busy === confirm.id}
          onCancel={() => setConfirm(null)}
          onGo={async () => {
            await checkOut(confirm);
            setConfirm(null);
          }}
          onPayAndGo={async () => {
            if (await markPaid(confirm)) await checkOut(confirm);
            setConfirm(null);
          }}
        />
      )}

      <div className={s.toast} role="status" aria-live="polite">
        {toast}
      </div>
    </main>
  );
}

function Column({
  title,
  count,
  tone,
  loading,
  empty,
  wide,
  children,
}: {
  title: string;
  count: number;
  tone: string;
  loading: boolean;
  empty: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`${s.card} ${wide ? s.wide : ""}`}>
      <div className={s.cardHead}>
        <h2>{title}</h2>
        <span className={`${s.badge} ${tone}`}>{count}</span>
      </div>
      {loading ? (
        <p className={s.empty}>Loading…</p>
      ) : count === 0 ? (
        <p className={s.empty}>{empty}</p>
      ) : (
        <ul className={s.list}>{children}</ul>
      )}
    </div>
  );
}

function Row({
  name,
  meta,
  children,
}: {
  name: string;
  meta: string;
  children: ReactNode;
}) {
  return (
    <li className={s.row}>
      <div className={s.who}>
        <strong>{name}</strong>
        <span>{meta}</span>
      </div>
      <div className={s.act}>{children}</div>
    </li>
  );
}
