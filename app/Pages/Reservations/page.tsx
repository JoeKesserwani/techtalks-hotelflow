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
  bucketDay,
  dayOnly,
  formatDate,
  guestName,
  money,
  nightsBetween,
  payment,
  roomLabel,
  shiftDate,
  todayInHotel,
  type Reservation,
} from "../../../lib/frontdesk";
import { useAuth } from "@/components/Auth/AuthProvider";

// TODO: replace with your session/user source (no "me" endpoint was provided).
const STAFF = { name: "Joanna D.", role: "Receptionist" };
// No rooms endpoint was provided; set NEXT_PUBLIC_TOTAL_ROOMS to show "of N".
const TOTAL_ROOMS = Number(process.env.NEXT_PUBLIC_TOTAL_ROOMS) || null;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

async function errorMessage(res: Response) {
  try {
    const body = await res.json();
    return body.error ?? body.message ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

type Task = { id: string; text: string; room?: string };

export default function FrontDeskPage() {
  const [today] = useState(todayInHotel);
  const [date, setDate] = useState(today);
  const [items, setItems] = useState<Reservation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});

  const { user } = useAuth();

  /* The list endpoint has no date filter, so we refetch on every date change (fresh data)
     and on window focus, then filter by the selected date on the client. */
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/v1/reservations", {
        signal,
        cache: "no-store",
      });
      if (res.status === 401)
        return setError("Your session has expired. Sign in again to continue.");
      if (!res.ok) throw new Error(await errorMessage(res));
      setItems(await res.json());
      setError(null);
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setError((e as Error).message || "Couldn't load reservations.");
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [date, load]);

  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem("frontdesk:tasks") ?? "{}"));
    } catch {}
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
  const isToday = date === today;
  const loading = items === null && !error;

  async function act(r: Reservation, kind: "check-in" | "check-out") {
    setBusy(r.id);
    try {
      const res = await fetch(`/api/v1/reservations/${r.id}/${kind}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      const updated: Reservation = await res.json();
      setItems(
        (prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? prev,
      );
      setToast(
        `${guestName(updated)} ${kind === "check-in" ? "checked in" : "checked out"}.`,
      );
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  /* Tasks are derived from the day's data; completion is stored per date in localStorage. */
  const tasks = useMemo<Task[]>(() => {
    const t: Task[] = [];
    day.departing.forEach((r) => {
      t.push({
        id: `clean-${r.id}`,
        text: `Mark room ${roomLabel(r)} as cleaned`,
        room: roomLabel(r),
      });
      if (payment(r).kind !== "paid")
        t.push({
          id: `pay-${r.id}`,
          text: "Follow up on unpaid balance",
          room: roomLabel(r),
        });
    });
    day.arriving
      .filter((r) => r.status !== "CHECKED_OUT")
      .forEach((r) =>
        t.push({
          id: `welcome-${r.id}`,
          text: `Prepare welcome note for ${guestName(r)}`,
          room: roomLabel(r),
        }),
      );
    t.push({ id: "keys", text: "Restock front desk key cards" });
    if (day.departing.length)
      t.push({ id: "late", text: "Send housekeeping the late checkout list" });
    return t;
  }, [day]);

  const isDone = (id: string) => !!done[`${date}:${id}`];
  const toggle = (id: string) =>
    setDone((prev) => {
      const next = { ...prev, [`${date}:${id}`]: !prev[`${date}:${id}`] };
      try {
        localStorage.setItem("frontdesk:tasks", JSON.stringify(next));
      } catch {}
      return next;
    });
  const doneCount = tasks.filter((t) => isDone(t.id)).length;

  const actionBtn = (r: Reservation, kind: "check-in" | "check-out") => (
    <button
      className={s.primary}
      disabled={busy === r.id}
      onClick={() => act(r, kind)}
      aria-label={`${kind === "check-in" ? "Check in" : "Check out"} ${guestName(r)}`}
    >
      {busy === r.id
        ? "Working…"
        : kind === "check-in"
          ? "Check in"
          : "Check out"}
    </button>
  );

  const visibleStaying = showAll ? day.staying : day.staying.slice(0, 2);
  const hidden = day.staying.length - 2;
  const initials = user?.fullName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
            <strong>{user?.fullName}</strong>
            <span>{user?.role}</span>
          </div>
        </div>
      </header>

      {error && (
        <div className={s.error} role="alert">
          <span>{error}</span>
          {error.includes("session") ? (
            <a href="/">Sign in</a>
          ) : (
            <button onClick={() => load()}>Retry</button>
          )}
        </div>
      )}

      <p className={s.summary} aria-live="polite">
        <i aria-hidden />
        <b>{day.arriving.length}</b>{" "}
        {day.arriving.length === 1 ? "arrival" : "arrivals"} ·{" "}
        <b>{day.departing.length}</b>{" "}
        {day.departing.length === 1 ? "departure" : "departures"} ·{" "}
        <b>{day.staying.length}</b> rooms occupied
        {TOTAL_ROOMS ? ` of ${TOTAL_ROOMS}` : ""}
      </p>

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
              meta={`Room ${roomLabel(r)} · ${plural(nightsBetween(r.checkInDate, r.checkOutDate), "night")}`}
            >
              {r.status === "BOOKED" ? (
                isToday ? (
                  actionBtn(r, "check-in")
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
                {r.status === "CHECKED_IN" && isToday ? (
                  actionBtn(r, "check-out")
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
          {visibleStaying.map((r) => {
            const needsCleaning = ["NEEDS_CLEANING", "CLEANING"].includes(
              String(r.room?.status),
            );
            return (
              <Row
                key={r.id}
                name={guestName(r)}
                meta={`Room ${roomLabel(r)} · until ${formatDate(dayOnly(r.checkOutDate), { month: "short", day: "numeric" })}`}
              >
                <span className={s.note}>
                  {needsCleaning ? "Needs cleaning" : payment(r).label}
                </span>
              </Row>
            );
          })}
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

      <section className={s.card} aria-labelledby="tasks-h">
        <div className={s.cardHead}>
          <h2 id="tasks-h">{isToday ? "Today's" : "Day's"} tasks</h2>
          <span className={`${s.badge} ${s.ink}`}>
            {doneCount} of {tasks.length}
          </span>
        </div>
        <ul className={s.tasks}>
          {tasks.map((t) => (
            <li key={t.id}>
              <label className={isDone(t.id) ? s.taskDone : undefined}>
                <input
                  type="checkbox"
                  checked={isDone(t.id)}
                  onChange={() => toggle(t.id)}
                />
                <span className={s.box} aria-hidden />
                <span className={s.taskText}>{t.text}</span>
              </label>
              {t.room && <span className={s.chip}>Room {t.room}</span>}
            </li>
          ))}
        </ul>
      </section>

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
