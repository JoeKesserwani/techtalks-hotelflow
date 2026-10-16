"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePopupMessage } from "@/components/PopupMessage";
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
  initialGuestId,
  onClose,
  onCreated,
  onConflict,
}: {
  defaultDate: string;
  today: string;
  rooms: Room[];
  reservations: Reservation[];
  initialRoomId?: string;
  initialGuestId?: string;
  onClose: () => void;
  onCreated: (r: Reservation) => void;
  onConflict: () => void;
}) {
  const { notify } = usePopupMessage();
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [q, setQ] = useState("");
  const [guestId, setGuestId] = useState(initialGuestId ?? "");
  const [inD, setIn] = useState(defaultDate < today ? today : defaultDate); // takes the page's date
  const [outD, setOut] = useState(
    shiftDate(defaultDate < today ? today : defaultDate, 1),
  );
  const [roomId, setRoomId] = useState(initialRoomId ?? "");
  const [pay, setPay] = useState<"UNPAID" | "PARTIAL" | "PAID">("UNPAID");
  const [amountPaid, setAmountPaid] = useState("");
  const [ack, setAck] = useState(false);
  const [saving, setSaving] = useState(false);
  const dlg = useRef<HTMLFormElement>(null);

  useEffect(() => {
    api<Guest[]>("/guests")
      .then(setGuests)
      .catch((e) => {
        setGuests([]);
        notify({
          kind: "error",
          title: "Guest list could not be loaded",
          description: e instanceof Error ? e.message : "Please try again.",
        });
      });
  }, [notify]);

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
  const totalPrice = chosen && nights ? Number(chosen.basePrice) * nights : 0;
  const partialAmount = Number(amountPaid);
  const partialAmountCents = Math.round(partialAmount * 100);
  const totalPriceCents = Math.round(totalPrice * 100);
  const partialAmountValid =
    amountPaid.trim() !== "" &&
    Number.isFinite(partialAmount) &&
    partialAmount > 0 &&
    Math.abs(partialAmountCents - partialAmount * 100) <= 1e-7 &&
    partialAmountCents <= totalPriceCents;
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
    !!guestId &&
    !!chosen &&
    datesOk &&
    (!gConflict || ack) &&
    (pay !== "PARTIAL" || partialAmountValid) &&
    !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const reservation = await api<Reservation>("/reservations", {
        method: "POST",
        body: JSON.stringify({
          roomId,
          guestId,
          checkInDate: inD,
          checkOutDate: outD,
          paymentStatus: pay,
          amountPaid: pay === "PARTIAL" ? partialAmount : undefined,
        }),
      });
      onCreated(reservation);
      notify({
        kind: "success",
        title: `Reservation created for ${guestName(reservation)}`,
        description: `Room ${roomLabel(reservation)}`,
      });
      dlg.current?.closest("dialog")?.close();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Please try again.";
      notify({
        kind: "error",
        title: "Reservation was not created",
        description: message,
      });
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
            <div className={`${s.twoCol} ${s.payOptions}`}>
              <label className={s.radio}>
                <input
                  type="radio"
                  name="payment"
                  checked={pay === "UNPAID"}
                  onChange={() => setPay("UNPAID")}
                />{" "}
                Unpaid
              </label>
              <label className={s.radio}>
                <input
                  type="radio"
                  name="payment"
                  checked={pay === "PAID"}
                  onChange={() => setPay("PAID")}
                />{" "}
                Paid in full
              </label>
              <label className={s.radio}>
                <input
                  type="radio"
                  name="payment"
                  checked={pay === "PARTIAL"}
                  onChange={() => setPay("PARTIAL")}
                />{" "}
                Partially paid
              </label>
            </div>
            {pay === "PARTIAL" && (
              <div className={s.partialPayment}>
                <div className={s.amountEntry}>
                  <label htmlFor="reservation-amount-paid">
                    Amount received
                  </label>
                  <div className={s.amountInput}>
                    <span className={s.currencyPrefix} aria-hidden="true">
                      $
                    </span>
                    <input
                      id="reservation-amount-paid"
                      type="number"
                      min="0.01"
                      max={totalPrice > 0 ? totalPrice : undefined}
                      step="0.01"
                      value={amountPaid}
                      required
                      aria-describedby="partial-payment-feedback"
                      onChange={(e) => setAmountPaid(e.target.value)}
                    />
                  </div>
                </div>
                {partialAmountValid ? (
                  <div
                    className={s.partialBalance}
                    id="partial-payment-feedback"
                    aria-live="polite"
                  >
                    <span>Remaining balance</span>
                    <strong>{money(totalPrice - partialAmount)}</strong>
                  </div>
                ) : (
                  <p
                    className={s.hint}
                    id="partial-payment-feedback"
                    aria-live="polite"
                  >
                    {chosen && nights
                      ? `Enter an amount from $0.01 up to ${money(totalPrice)}.`
                      : "Select dates and a room to calculate the reservation total."}
                  </p>
                )}
              </div>
            )}
          </fieldset>
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
