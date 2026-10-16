"use client";

import { useMemo, useState } from "react";
import s from "./page.module.css";
import { Dialog } from "./dialogs";
import {
  ACTIVE,
  api,
  dayOnly,
  findRoomConflict,
  formatDate,
  guestName,
  money,
  nightsBetween,
  payment,
  roomLabel,
  shiftDate,
  type Reservation,
  type Room,
} from "./frontdesk";
import { useAuth } from "@/components/Auth/AuthProvider";

const short = (d: string) => formatDate(d, { month: "short", day: "numeric" });
const nightsText = (n: number) => `${n} night${n === 1 ? "" : "s"}`;
const later = (a: string, b: string) => (a > b ? a : b);

/* Mirrors the server rules in amend/route.ts. */
const IN_HOUSE_BLOCKED = [
  "OCCUPIED",
  "NEEDS_CLEANING",
  "CLEANING",
  "IN_REVIEW",
  "OUT_OF_SERVICE",
  "MAINTENANCE",
];
const NEVER_BOOKABLE = ["OUT_OF_SERVICE", "MAINTENANCE"];
const STATUS_TEXT: Record<string, string> = {
  OCCUPIED: "Occupied",
  NEEDS_CLEANING: "Needs cleaning",
  CLEANING: "Being cleaned",
  IN_REVIEW: "Awaiting inspection",
  OUT_OF_SERVICE: "Out of service",
  MAINTENANCE: "Under maintenance",
};

type Mode = "extend" | "move";

export function EditReservationDialog({
  r,
  today,
  rooms,
  reservations,
  onClose,
  onSaved,
  onConflict,
  onFailure,
}: {
  r: Reservation;
  today: string;
  rooms: Room[];
  reservations: Reservation[];
  onClose: () => void;
  onSaved: (updated: Reservation) => void;
  onConflict: () => void;
  onFailure?: (message: string) => void;
}) {
  const { currencySymbol } = useAuth();
  const inHouse = r.status === "CHECKED_IN";
  const curIn = dayOnly(r.checkInDate);
  const curOut = dayOnly(r.checkOutDate);

  const [mode, setMode] = useState<Mode>("extend");
  const [inD, setIn] = useState(curIn);
  const [outD, setOut] = useState(curOut);
  const [roomId, setRoomId] = useState(r.roomId);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const showDates = !inHouse || mode === "extend";
  const showRooms = !inHouse || mode === "move";

  /* In-house guests: extension must end after both the current check-out and today (covers overstays). */
  const minOut = inHouse
    ? shiftDate(later(curOut, today), 1)
    : shiftDate(inD, 1);
  const effOut = inHouse && mode === "move" ? curOut : outD;
  const effRoomId = inHouse && mode === "extend" ? r.roomId : roomId;
  const windowStart = inHouse && mode === "move" ? later(curIn, today) : inD;

  const datesOk = inHouse
    ? mode === "move" || outD >= minOut
    : inD >= today && outD > inD;

  /* Earliest later booking in the same room: the hard ceiling for an extension. */
  const limit = useMemo(
    () =>
      reservations
        .filter(
          (x) =>
            x.id !== r.id &&
            x.roomId === r.roomId &&
            ACTIVE.includes(x.status) &&
            dayOnly(x.checkInDate) >= curOut,
        )
        .map((x) => dayOnly(x.checkInDate))
        .sort()[0],
    [reservations, r.id, r.roomId, curOut],
  );
  const blockedNow = inHouse && !!limit && limit < minOut; // nothing can be added to this stay in this room

  const options = useMemo(
    () =>
      rooms
        .map((room) => {
          const st = String(room.status);
          let reason: string | null = null;
          if (inHouse && room.id === r.roomId) reason = "Current room";
          else if (
            room.id !== r.roomId &&
            (inHouse ? IN_HOUSE_BLOCKED : NEVER_BOOKABLE).includes(st)
          )
            reason = STATUS_TEXT[st] ?? "Unavailable";
          else if (effOut > windowStart) {
            const c = findRoomConflict(
              reservations,
              room.id,
              windowStart,
              effOut,
              r.id,
            );
            if (c)
              reason = `Booked ${short(dayOnly(c.checkInDate))} – ${short(dayOnly(c.checkOutDate))} (${guestName(c)})`;
          }
          return { room, reason };
        })
        .sort(
          (a, b) =>
            Number(!!a.reason) - Number(!!b.reason) ||
            a.room.roomNumber.localeCompare(b.room.roomNumber, undefined, {
              numeric: true,
            }),
        ),
    [rooms, reservations, inHouse, r.id, r.roomId, windowStart, effOut],
  );

  const picked = options.find((o) => o.room.id === effRoomId);
  const roomOk =
    inHouse && mode === "extend"
      ? !findRoomConflict(reservations, r.roomId, curIn, effOut, r.id)
      : !!picked && !picked.reason;

  const changed = inHouse
    ? mode === "extend"
      ? outD !== curOut
      : roomId !== r.roomId
    : inD !== curIn || outD !== curOut || roomId !== r.roomId;

  /* Price preview (same rules as the server). */
  const newRoom = rooms.find((x) => x.id === effRoomId);
  const reprice = !inHouse && effRoomId !== r.roomId;
  const rate = reprice
    ? Number(newRoom?.basePrice ?? r.pricePerNight)
    : Number(r.pricePerNight);
  const newNights = datesOk
    ? nightsBetween(inHouse ? curIn : inD, effOut)
    : nightsBetween(curIn, curOut);
  const newTotal = rate * newNights;
  const delta = newTotal - Number(r.totalPrice);
  const becomesPartial = payment(r).kind === "paid" && delta > 0;

  const canSave = changed && datesOk && roomOk && !saving;

  function pickIn(v: string) {
    if (!v) return;
    const len = outD > inD ? nightsBetween(inD, outD) : 1; // keep the stay length when moving the arrival
    setIn(v);
    setOut(shiftDate(v, len));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setErr(null);
    const body = inHouse
      ? mode === "extend"
        ? { checkOutDate: outD }
        : { roomId }
      : { roomId, checkInDate: inD, checkOutDate: outD };
    try {
      onSaved(
        await api<Reservation>(`/reservations/${r.id}/amend`, {
          method: "PATCH",
          body: JSON.stringify(body),
        }),
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Please try again.";
      setErr(message);
      onFailure?.(message);
      onConflict(); // refresh so the lists show what changed under us
    } finally {
      setSaving(false);
    }
  }

  const chipBase = later(curOut, today);

  return (
    <Dialog label="Edit reservation" onClose={onClose}>
      <form onSubmit={submit} className={s.form}>
        <div className={s.dlgBody}>
          <h2>Edit reservation</h2>
          <p className={s.dlgSummary}>
            <strong>{guestName(r)}</strong> · Room {roomLabel(r)} ·{" "}
            {short(curIn)} – {short(curOut)} (
            {nightsText(nightsBetween(curIn, curOut))}) ·{" "}
            {inHouse ? "In-house" : "Not arrived yet"}
          </p>

          {inHouse && (
            <div
              className={s.seg}
              role="group"
              aria-label="What do you want to change?"
            >
              <button
                type="button"
                aria-pressed={mode === "extend"}
                onClick={() => {
                  setMode("extend");
                  setErr(null);
                }}
              >
                Extend stay
              </button>
              <button
                type="button"
                aria-pressed={mode === "move"}
                onClick={() => {
                  setMode("move");
                  setErr(null);
                }}
              >
                Change room
              </button>
            </div>
          )}

          {showDates && (
            <fieldset>
              <legend>{inHouse ? "New check-out date" : "Dates"}</legend>
              {inHouse ? (
                <>
                  <div className={s.chips}>
                    {[1, 2, 3, 7].map((n) => {
                      const t = shiftDate(chipBase, n);
                      return (
                        <button
                          type="button"
                          key={n}
                          aria-pressed={outD === t}
                          disabled={!!limit && t > limit}
                          onClick={() => setOut(t)}
                        >
                          +{nightsText(n)}
                        </button>
                      );
                    })}
                  </div>
                  <label style={{ marginTop: 12 }}>
                    Or pick a date
                    <input
                      type="date"
                      value={outD}
                      min={minOut}
                      max={limit}
                      onChange={(e) => e.target.value && setOut(e.target.value)}
                    />
                  </label>
                  <p className={s.hint}>
                    {blockedNow
                      ? `Room ${roomLabel(r)} is already booked from ${short(limit!)}, so this stay can't be extended in this room. Use "Change room" to move the guest.`
                      : limit
                        ? `Room ${roomLabel(r)} is free until ${short(limit)}. A longer stay needs a different room.`
                        : `No later booking on Room ${roomLabel(r)}.`}
                  </p>
                </>
              ) : (
                <>
                  <div className={s.twoCol}>
                    <label>
                      Check-in
                      <input
                        type="date"
                        value={inD}
                        min={today}
                        required
                        onChange={(e) => pickIn(e.target.value)}
                      />
                    </label>
                    <label>
                      Check-out
                      <input
                        type="date"
                        value={outD}
                        min={shiftDate(inD, 1)}
                        required
                        onChange={(e) =>
                          e.target.value && setOut(e.target.value)
                        }
                      />
                    </label>
                  </div>
                  <p className={s.hint}>
                    {datesOk
                      ? nightsText(nightsBetween(inD, outD))
                      : "Check-in can't be in the past and check-out must be after check-in."}
                  </p>
                </>
              )}
            </fieldset>
          )}

          {showRooms && (
            <fieldset>
              <legend>{inHouse ? "Move to" : "Room"}</legend>
              <ul className={s.pick} role="radiogroup" aria-label="Rooms">
                {options.map(({ room, reason }) => (
                  <li key={room.id}>
                    <label
                      className={`${effRoomId === room.id && !reason ? s.picked : ""} ${reason ? s.blocked : ""}`}
                    >
                      <input
                        type="radio"
                        name="room"
                        disabled={!!reason}
                        checked={effRoomId === room.id && !reason}
                        onChange={() => setRoomId(room.id)}
                      />
                      <span>
                        <strong>
                          Room {room.roomNumber}
                          {room.roomType ? ` · ${room.roomType}` : ""}
                        </strong>
                        <small>
                          {reason ??
                            `${money(room.basePrice, currencySymbol)} / night${room.capacity ? ` · sleeps ${room.capacity}` : ""}`}
                        </small>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className={s.hint}>
                {inHouse
                  ? `Only rooms that are clean, ready and free until ${short(curOut)} can be picked. The old room goes to housekeeping automatically.`
                  : "Rooms that overlap another active reservation, or are out of service, are disabled."}
              </p>
            </fieldset>
          )}

          <div className={s.info}>
            {reprice
              ? `Repriced at Room ${newRoom?.roomNumber}'s rate (${money(rate, currencySymbol)} / night).`
              : `The agreed rate of ${money(rate, currencySymbol)} / night stays the same.`}
            {becomesPartial &&
              ` This reservation is marked paid, so the extra ${money(delta, currencySymbol)} will leave a balance and it will switch to partial paid.`}
          </div>

          {err && (
            <div className={s.warn} role="alert">
              {err}
            </div>
          )}
        </div>

        <div className={s.dlgFoot}>
          <span className={s.total}>
            {changed && datesOk && roomOk
              ? `${nightsText(newNights)} · ${money(newTotal, currencySymbol)}${delta ? ` (${delta > 0 ? "+" : "−"}${money(Math.abs(delta), currencySymbol)})` : ""}`
              : "No changes yet"}
          </span>
          <button type="button" className={s.soft} onClick={onClose}>
            Close
          </button>
          <button type="submit" className={s.primary} disabled={!canSave}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function CancelReservationDialog({
  r,
  busy,
  onKeep,
  onConfirm,
}: {
  r: Reservation;
  busy: boolean;
  onKeep: () => void;
  onConfirm: (reason: string) => void;
}) {
  const { currencySymbol } = useAuth();
  const [reason, setReason] = useState("");
  const p = payment(r);
  return (
    <Dialog label="Cancel reservation" onClose={onKeep}>
      <div className={s.dlgBody}>
        <h2>Cancel this reservation?</h2>
        <p className={s.dlgSummary}>
          <strong>{guestName(r)}</strong> · Room {roomLabel(r)} ·{" "}
          {short(dayOnly(r.checkInDate))} – {short(dayOnly(r.checkOutDate))} ·{" "}
          {money(r.totalPrice, currencySymbol)}
        </p>
        <p className={s.sub}>
          The room becomes available for those dates again. This can't be
          undone.
        </p>
        {p.kind !== "unpaid" && (
          <div className={s.warn} role="alert">
            This reservation is marked <strong>{p.label.toLowerCase()}</strong>.
            Any refund has to be handled separately, HotelFlow doesn't record
            refunds.
          </div>
        )}
        <fieldset>
          <label>
            Reason (optional)
            <input
              type="text"
              value={reason}
              maxLength={200}
              placeholder="e.g. Guest changed plans"
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </fieldset>
      </div>
      <div className={s.dlgFoot}>
        <button className={s.soft} onClick={onKeep} disabled={busy}>
          Keep reservation
        </button>
        <button
          className={s.destructive}
          onClick={() => onConfirm(reason)}
          disabled={busy}
        >
          {busy ? "Cancelling…" : "Cancel reservation"}
        </button>
      </div>
    </Dialog>
  );
}
