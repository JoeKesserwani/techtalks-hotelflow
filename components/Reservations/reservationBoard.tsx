"use client";

import { useMemo, useState, type ReactNode } from "react";
import s from "./reservationBoard.module.css";
import {
  api,
  bucketDay,
  dayOnly,
  formatDate,
  guestName,
  nightsBetween,
  payment,
  paymentSummary,
  roomLabel,
  type Reservation,
  type Room,
} from "../../app/Pages/Reservations/frontdesk";
import { ConfirmCheckout } from "../../app/Pages/Reservations/dialogs";
import {
  CancelReservationDialog,
  EditReservationDialog,
} from "../../app/Pages/Reservations/edit-dialogs";
import AssignTaskModal from "../Housekeeping/AssignTaskModal";
import type { ReservationFeedback } from "@/components/PopupMessage";

import { useAuth } from "../Auth/AuthProvider";

const PAGE_SIZE = 4;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

type ColumnKey = "arriving" | "departing" | "staying";
type ColumnPage = { signature: string; page: number };
const NO_PAGES: Record<ColumnKey, ColumnPage> = {
  arriving: { signature: "", page: 0 },
  departing: { signature: "", page: 0 },
  staying: { signature: "", page: 0 },
};

export interface ReservationsBoardProps {
  /** Selected business date, "YYYY-MM-DD" in the hotel's timezone. */
  date: string;
  /** Today in the hotel's timezone, same format. */
  today: string;
  /** All reservations, or null while the first load is in flight. */
  items: Reservation[] | null;
  rooms: Room[];
  loading: boolean;
  /** A reservation changed on the server (check-in/out, payment, edit): swap it in the owner's list. */
  onUpdate: (r: Reservation) => void;
  /** A reservation was cancelled: drop it from the owner's list. */
  onRemove: (id: string) => void;
  /** Refetch reservations and rooms (room statuses change after most actions). */
  onReload: () => void;
  /** Show the outcome of a reservation action in the owner's popup. */
  onToast: (feedback: ReservationFeedback) => void;
}

/** Arriving / Departing / Staying columns with check-in, check-out, payment, edit and cancel actions. */
export function ReservationsBoard({
  date,
  today,
  items,
  rooms,
  loading,
  onUpdate,
  onRemove,
  onReload,
  onToast,
}: ReservationsBoardProps) {
  const { currencySymbol } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [pages, setPages] = useState(NO_PAGES);
  const [confirm, setConfirm] = useState<Reservation | null>(null);
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [cancelling, setCancelling] = useState<Reservation | null>(null);
  const [taskReservation, setTaskReservation] = useState<Reservation | null>(
    null,
  );
  const [markPaidAfterTask, setMarkPaidAfterTask] = useState(false);

  const day = useMemo(
    () => bucketDay(items ?? [], date, today),
    [items, date, today],
  );
  const isToday = date === today;

  /* Pagination: clamp the page when a list shrinks (after a check-out or a cancellation). */
  const signatureOf = (list: Reservation[]) =>
    JSON.stringify([date, list.map((reservation) => reservation.id)]);
  const pageOf = (key: ColumnKey, list: Reservation[]) => {
    const storedPage =
      pages[key].signature === signatureOf(list) ? pages[key].page : 0;
    return Math.min(
      storedPage,
      Math.max(0, Math.ceil(list.length / PAGE_SIZE) - 1),
    );
  };
  const slice = (key: ColumnKey, list: Reservation[]) => {
    const p = pageOf(key, list);
    return list.slice(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE);
  };
  const pager = (key: ColumnKey, list: Reservation[]) => (
    <Pager
      page={pageOf(key, list)}
      total={list.length}
      label={key}
      onPage={(page) =>
        setPages((prev) => ({
          ...prev,
          [key]: { signature: signatureOf(list), page },
        }))
      }
    />
  );

  async function run(
    r: Reservation,
    path: string,
    init: RequestInit,
    successTitle: string,
    failureTitle: string,
  ) {
    setBusy(r.id);
    try {
      onUpdate(await api<Reservation>(`/reservations/${r.id}/${path}`, init));
      onToast({ status: "success", title: successTitle });
      onReload(); // room statuses changed too (occupied / needs cleaning): keep the board truthful
      return true;
    } catch (e) {
      onToast({
        status: "error",
        title: failureTitle,
        message: e instanceof Error ? e.message : "Please try again.",
      });
      return false;
    } finally {
      setBusy(null);
    }
  }
  const checkIn = (r: Reservation) =>
    run(
      r,
      "check-in",
      { method: "POST" },
      `${guestName(r)} checked in`,
      "Check-in failed",
    );
  const checkOut = (r: Reservation) =>
    run(
      r,
      "check-out",
      { method: "POST" },
      `${guestName(r)} checked out`,
      "Check-out failed",
    );
  const checkOutAfterTask = async (r: Reservation) => {
    if (markPaidAfterTask && !(await markPaid(r))) {
      throw new Error(
        "The housekeeping task was created, but payment could not be updated. Retry to continue check-out.",
      );
    }

    const checkedOut = await checkOut(r);
    if (!checkedOut) {
      throw new Error(
        "The housekeeping task was created, but check-out failed. Retry check-out or close this dialog.",
      );
    }
    setTaskReservation(null);
    setMarkPaidAfterTask(false);
  };
  const requestCheckout = (r: Reservation) => {
    if (payment(r).kind === "paid") {
      setMarkPaidAfterTask(false);
      setTaskReservation(r);
    } else {
      setConfirm(r);
    }
  };
  const markPaid = (r: Reservation) =>
    run(
      r,
      "payment",
      { method: "PATCH", body: JSON.stringify({ paymentStatus: "PAID" }) },
      `${guestName(r)} marked as paid`,
      "Payment update failed",
    );

  async function cancelReservation(r: Reservation, reason: string) {
    setBusy(r.id);
    try {
      await api(`/reservations/${r.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      onRemove(r.id);
      onToast({
        status: "success",
        title: `Reservation for ${guestName(r)} cancelled`,
      });
    } catch (e) {
      onToast({
        status: "error",
        title: "Cancellation failed",
        message: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy(null);
      setCancelling(null);
      onReload(); // success or failure, show what the server says now
    }
  }

  /* Edit: in-house guests (extend / move room) and upcoming bookings. A no-show whose date has passed can only be cancelled. */
  const canEdit = (r: Reservation) =>
    r.status === "CHECKED_IN" ||
    (r.status === "BOOKED" && dayOnly(r.checkInDate) >= today);
  const canCancel = (r: Reservation) => r.status === "BOOKED";

  const links = (r: Reservation) =>
    canEdit(r) || canCancel(r) ? (
      <div className={s.rowLinks}>
        {canEdit(r) && (
          <button
            className={s.link}
            onClick={() => setEditing(r)}
            aria-label={`Edit reservation for ${guestName(r)}`}
          >
            Edit
          </button>
        )}
        {canCancel(r) && (
          <button
            className={`${s.link} ${s.danger}`}
            onClick={() => setCancelling(r)}
            aria-label={`Cancel reservation for ${guestName(r)}`}
          >
            Cancel
          </button>
        )}
      </div>
    ) : null;

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

  return (
    <>
      <section className={s.board}>
        <Column
          title="Arriving"
          count={day.arriving.length}
          tone={s.slate}
          loading={loading}
          empty="No arrivals on this date."
          footer={pager("arriving", day.arriving)}
        >
          {slice("arriving", day.arriving).map((r) => (
            <Row
              key={r.id}
              name={guestName(r)}
              extras={links(r)}
              meta={`Room ${roomLabel(r)} · ${plural(nightsBetween(r.checkInDate, r.checkOutDate), "night")} · ${paymentSummary(r)}`}
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
                <span className={s.note}>
                  {r.status === "CHECKED_OUT" ? "Checked out" : "Checked in"}
                </span>
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
          footer={pager("departing", day.departing)}
        >
          {slice("departing", day.departing).map((r) => {
            return (
              <Row
                key={r.id}
                name={guestName(r)}
                extras={links(r)}
                meta={`Room ${roomLabel(r)} · ${paymentSummary(r)}`}
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
          footer={pager("staying", day.staying)}
        >
          {slice("staying", day.staying).map((r) => (
            <Row
              key={r.id}
              name={guestName(r)}
              extras={links(r)}
              meta={`Room ${roomLabel(r)} · until ${formatDate(dayOnly(r.checkOutDate), { month: "short", day: "numeric" })} · ${paymentSummary(r)}`}
            >
              {paidBtn(r)}
            </Row>
          ))}
        </Column>
      </section>

      {editing && (
        <EditReservationDialog
          r={editing}
          today={today}
          rooms={rooms}
          reservations={items ?? []}
          onClose={() => setEditing(null)}
          onConflict={onReload}
          onFailure={(message) =>
            onToast({
              status: "error",
              title: "Reservation update failed",
              message,
            })
          }
          onSaved={(u) => {
            onUpdate(u);
            setEditing(null);
            onToast({
              status: "success",
              title: `Reservation updated for ${guestName(u)}`,
              message: `Room ${roomLabel(u)}`,
            });
            onReload(); // a room move changes two rooms' statuses
          }}
        />
      )}

      {cancelling && (
        <CancelReservationDialog
          r={cancelling}
          busy={busy === cancelling.id}
          onKeep={() => setCancelling(null)}
          onConfirm={(reason) => cancelReservation(cancelling, reason)}
        />
      )}

      {confirm && (
        <ConfirmCheckout
          r={confirm}
          busy={busy === confirm.id}
          onCancel={() => setConfirm(null)}
          onGo={() => {
            setMarkPaidAfterTask(false);
            setTaskReservation(confirm);
            setConfirm(null);
          }}
          onPayAndGo={() => {
            setMarkPaidAfterTask(true);
            setTaskReservation(confirm);
            setConfirm(null);
          }}
        />
      )}

      {taskReservation && (
        <AssignTaskModal
          isOpen
          roomId={taskReservation.roomId}
          roomNumber={roomLabel(taskReservation)}
          onClose={() => {
            setTaskReservation(null);
            setMarkPaidAfterTask(false);
          }}
          onCreated={() => checkOutAfterTask(taskReservation)}
        />
      )}
    </>
  );
}

function Column({
  title,
  count,
  tone,
  loading,
  empty,
  wide,
  footer,
  children,
}: {
  title: string;
  count: number;
  tone: string;
  loading: boolean;
  empty: string;
  wide?: boolean;
  footer?: ReactNode;
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
      {footer}
    </div>
  );
}

function Row({
  name,
  meta,
  extras,
  children,
}: {
  name: string;
  meta: string;
  extras?: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className={s.row}>
      <div className={s.who}>
        <strong>{name}</strong>
        <span>{meta}</span>
        {extras}
      </div>
      <div className={s.act}>{children}</div>
    </li>
  );
}

/** Shown only when a list has more than PAGE_SIZE entries. */
function Pager({
  page,
  total,
  label,
  onPage,
}: {
  page: number;
  total: number;
  label: string;
  onPage: (p: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const from = page * PAGE_SIZE + 1;
  const to = Math.min(total, from + PAGE_SIZE - 1);
  return (
    <nav className={s.pager} aria-label={`${label} pages`}>
      <span>
        {from}–{to} of {total}
      </span>
      <div>
        <button
          className={s.arrow}
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          ‹
        </button>
        <span aria-live="polite">
          {page + 1} / {pageCount}
        </span>
        <button
          className={s.arrow}
          disabled={page >= pageCount - 1}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </nav>
  );
}
