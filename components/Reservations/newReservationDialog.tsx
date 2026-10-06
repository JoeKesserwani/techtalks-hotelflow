"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import s from "./newReservationDialog.module.css";
import { Dialog } from "../../app/Pages/Reservations/dialogs";
import {
  ApiError,
  api,
  findGuestConflict,
  findRoomConflict,
  formatDate,
  guestName,
  money,
  nightsBetween,
  roomLabel,
  shiftDate,
  type Guest,
  type Reservation,
  type Room,
} from "../../app/Pages/Reservations/frontdesk";

export function NewReservationDialog({
  defaultDate,
  today,
  rooms,
  reservations,
  initialRoomId,
  onClose,
  onCreated,
  onConflict,
}: {
  defaultDate: string;
  today: string;
  rooms: Room[];
  reservations: Reservation[];
  initialRoomId?: string;
  onClose: () => void;
  onCreated: (r: Reservation) => void;
  onConflict: () => void;
}) {
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [q, setQ] = useState("");
  const [guestId, setGuestId] = useState("");
  const [inD, setIn] = useState(defaultDate < today ? today : defaultDate); // takes the page's date
  const [outD, setOut] = useState(
    shiftDate(defaultDate < today ? today : defaultDate, 1),
  );
  const [roomId, setRoomId] = useState(initialRoomId ?? "");
  const [pay, setPay] = useState<"UNPAID" | "PAID">("UNPAID");
  const [ack, setAck] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dlg = useRef<HTMLFormElement>(null);

  useEffect(() => {
    api<Guest[]>("/guests")
      .then(setGuests)
      .catch((e) => {
        setGuests([]);
        setErr(e.message);
      });
  }, []);

  const datesOk = inD >= today && outD > inD;
  const nights = datesOk ? nightsBetween(inD, outD) : 0;

  const options = useMemo(
    () =>
      rooms
        .map((room) => {
          const c = datesOk
            ? findRoomConflict(reservations, room.id, inD, outD)
            : undefined;
          const reason =
            room.status === "OUT_OF_SERVICE"
              ? "Out of service"
              : c
                ? `Booked ${formatDate(c.checkInDate.slice(0, 10), { month: "short", day: "numeric" })} – ${formatDate(c.checkOutDate.slice(0, 10), { month: "short", day: "numeric" })} (${guestName(c)})`
                : null;
          return { room, reason };
        })
        .sort((a, b) => Number(!!a.reason) - Number(!!b.reason)),
    [rooms, reservations, inD, outD, datesOk],
  );

  const chosen = options.find((o) => o.room.id === roomId && !o.reason)?.room;
  const gConflict =
    guestId && datesOk
      ? findGuestConflict(reservations, guestId, inD, outD)
      : undefined;
  const list = (guests ?? []).filter((g) =>
    `${g.fullName} ${g.phone ?? ""} ${g.email ?? ""}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  const canSave =
    !!guestId && !!chosen && datesOk && (!gConflict || ack) && !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setErr(null);
    try {
      onCreated(
        await api<Reservation>("/reservations", {
          method: "POST",
          body: JSON.stringify({
            roomId,
            guestId,
            checkInDate: inD,
            checkOutDate: outD,
            paymentStatus: pay,
          }),
        }),
      );
      dlg.current?.closest("dialog")?.close();
    } catch (e) {
      setErr((e as Error).message);
      if ((e as ApiError).status === 409) {
        setRoomId("");
        onConflict();
      } // someone else booked it first: refresh availability
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog label="New reservation" onClose={onClose}>
      <form ref={dlg} onSubmit={submit} className={s.form}>
        <div className={s.dlgBody}>
          <h2>New reservation</h2>

          <fieldset>
            <legend>1 · Dates</legend>
            <div className={s.twoCol}>
              <label>
                Check-in
                <input
                  type="date"
                  value={inD}
                  min={today}
                  required
                  onChange={(e) => {
                    setIn(e.target.value);
                    if (outD <= e.target.value)
                      setOut(shiftDate(e.target.value, 1));
                  }}
                />
              </label>
              <label>
                Check-out
                <input
                  type="date"
                  value={outD}
                  min={shiftDate(inD, 1)}
                  required
                  onChange={(e) => setOut(e.target.value)}
                />
              </label>
            </div>
            <p className={s.hint}>
              {datesOk
                ? plural(nights)
                : "Check-in can't be in the past and check-out must be after check-in."}
            </p>
          </fieldset>

          <fieldset>
            <legend>2 · Guest</legend>
            <input
              type="search"
              placeholder="Search name, phone or email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search guests"
            />
            <ul className={s.pick} role="radiogroup" aria-label="Guests">
              {guests === null && <li className={s.hint}>Loading guests…</li>}
              {guests && list.length === 0 && (
                <li className={s.hint}>No guests match.</li>
              )}
              {list.map((g) => (
                <li key={g.id}>
                  <label className={guestId === g.id ? s.picked : undefined}>
                    <input
                      type="radio"
                      name="guest"
                      checked={guestId === g.id}
                      onChange={() => {
                        setGuestId(g.id);
                        setAck(false);
                      }}
                    />
                    <span>
                      <strong>{g.fullName}</strong>
                      <small>
                        {[g.phone, g.email].filter(Boolean).join(" · ") ||
                          "No contact info"}
                      </small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {gConflict && (
              <div className={s.warn} role="alert">
                {guestName(gConflict)} already has a reservation in Room{" "}
                {roomLabel(gConflict)} that overlaps these dates.
                <label>
                  <input
                    type="checkbox"
                    checked={ack}
                    onChange={(e) => setAck(e.target.checked)}
                  />{" "}
                  Book another room anyway
                </label>
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend>3 · Room</legend>
            <ul className={s.pick} role="radiogroup" aria-label="Rooms">
              {options.map(({ room, reason }) => (
                <li key={room.id}>
                  <label
                    className={`${roomId === room.id && !reason ? s.picked : ""} ${reason ? s.blocked : ""}`}
                  >
                    <input
                      type="radio"
                      name="room"
                      disabled={!!reason}
                      checked={roomId === room.id && !reason}
                      onChange={() => setRoomId(room.id)}
                    />
                    <span>
                      <strong>
                        Room {room.roomNumber}
                        {room.roomType ? ` · ${room.roomType}` : ""}
                      </strong>
                      <small>
                        {reason ??
                          `${money(room.basePrice)} / night${room.capacity ? ` · sleeps ${room.capacity}` : ""}`}
                      </small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset>
            <legend>4 · Payment</legend>
            <div className={s.twoCol}>
              <label className={s.radio}>
                <input
                  type="radio"
                  checked={pay === "UNPAID"}
                  onChange={() => setPay("UNPAID")}
                />{" "}
                Unpaid
              </label>
              <label className={s.radio}>
                <input
                  type="radio"
                  checked={pay === "PAID"}
                  onChange={() => setPay("PAID")}
                />{" "}
                Paid in full
              </label>
            </div>
          </fieldset>

          {err && (
            <div className={s.warn} role="alert">
              {err}
            </div>
          )}
        </div>

        <div className={s.dlgFoot}>
          <span className={s.total}>
            {chosen && nights
              ? `${plural(nights)} · ${money(Number(chosen.basePrice) * nights)}`
              : "Select dates, guest and room"}
          </span>
          <button
            type="button"
            className={s.soft}
            onClick={() => dlg.current?.closest("dialog")?.close()}
          >
            Cancel
          </button>
          <button type="submit" className={s.primary} disabled={!canSave}>
            {saving ? "Saving…" : "Create reservation"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

const plural = (n: number) => `${n} night${n === 1 ? "" : "s"}`;
