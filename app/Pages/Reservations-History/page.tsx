"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Pagination from "@/components/Pagination";
import styles from "./page.module.css";
import Header from "@/components/Header/Header";

/*
 * ================================
 * TYPES
 * ================================
 */

type Guest = { id: string; fullName: string; phone?: string | null };
type Room = { id: string; roomNumber: string; roomType?: string | null };

type Reservation = {
  id: string;
  roomId: string;
  guestId: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  pricePerNight: string | number;
  totalPrice: string | number;
  paymentStatus: string;
  guest?: Guest;
  room?: Room;
};

type Period = "all" | "this_month" | "last_30" | "this_year" | "custom";
type PayFilter = "all" | "PAID" | "PARTIAL" | "UNPAID";
type SortKey = "newest" | "oldest" | "highest" | "guest";
type PayKind = "PAID" | "PARTIAL" | "UNPAID";

const ITEMS_PER_PAGE = 8;

/*
 * ================================
 * HELPERS
 * ================================
 *
 * Reservation dates are calendar dates (UTC-midnight in the database). They are
 * handled as "YYYY-MM-DD" strings and never through the browser's local timezone.
 */

const DAY_MS = 86_400_000;

const getTodayString = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Beirut",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const dayOnly = (value: string) => String(value ?? "").slice(0, 10);
const toUtc = (day: string) => new Date(`${day}T00:00:00.000Z`);
const shiftDay = (day: string, delta: number) =>
  new Date(toUtc(day).getTime() + delta * DAY_MS).toISOString().slice(0, 10);

const nightsBetween = (checkIn: string, checkOut: string) => {
  const diff = Math.round(
    (toUtc(dayOnly(checkOut)).getTime() - toUtc(dayOnly(checkIn)).getTime()) /
      DAY_MS,
  );
  return Math.max(1, Number.isFinite(diff) ? diff : 1);
};

const formatDate = (value: string) => {
  const day = dayOnly(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "-";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(toUtc(day));
};

const formatMoney = (value: string | number) => {
  const n = Number(value);
  return `$${(Number.isFinite(n) ? n : 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

const titleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

/* "UNPAID" contains "PAID", so test for exact / partial values first. */
const payKindOf = (status: string): PayKind => {
  const s = String(status).toUpperCase();
  if (s.includes("PARTIAL")) return "PARTIAL";
  if (s === "PAID") return "PAID";
  return "UNPAID";
};

const PAY_LABEL: Record<PayKind, string> = {
  PAID: "Paid",
  PARTIAL: "Partial",
  UNPAID: "Unpaid",
};

/** CSV cell with quote escaping and protection against spreadsheet formula injection. */
const csvCell = (value: unknown) => {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const readApiResponse = async (response: Response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Server returned ${response.status} instead of JSON.`);
  }
};

/*
 * ================================
 * PAGE
 * ================================
 */

export default function ReservationHistoryPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [me, setMe] = useState<{ fullName: string; role: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [payFilter, setPayFilter] = useState<PayFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [currentPage, setCurrentPage] = useState(1);

  const [toDelete, setToDelete] = useState<Reservation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const today = getTodayString();

  /* ---------- load ---------- */

  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/reservations", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await readApiResponse(response);

      if (response.status === 401) {
        setExpired(true);
        throw new Error("Your session has expired. Sign in again to continue.");
      }
      if (!response.ok) {
        throw new Error(
          data?.error || data?.message || "Failed to load reservations",
        );
      }

      setReservations(
        Array.isArray(data) ? data : data?.data || data?.reservations || [],
      );
      setError("");
      setExpired(false);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to load reservations",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  useEffect(() => {
    fetch("/api/v1/auth/me", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => data?.user && setMe(data.user))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  /* ---------- derived data ---------- */

  /* History = stays that are finished. Everything else lives on the front-desk page. */
  const history = useMemo(
    () => reservations.filter((r) => r.status === "CHECKED_OUT"),
    [reservations],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    const inPeriod = (r: Reservation) => {
      const out = dayOnly(r.checkOutDate);
      switch (period) {
        case "this_month":
          return out.slice(0, 7) === today.slice(0, 7);
        case "last_30":
          return out >= shiftDay(today, -30) && out <= today;
        case "this_year":
          return out.slice(0, 4) === today.slice(0, 4);
        case "custom":
          return (!from || out >= from) && (!to || out <= to);
        default:
          return true;
      }
    };

    const rows = history.filter((r) => {
      if (payFilter !== "all" && payKindOf(r.paymentStatus) !== payFilter)
        return false;
      if (!inPeriod(r)) return false;
      if (!query) return true;
      return (
        (r.guest?.fullName ?? "").toLowerCase().includes(query) ||
        (r.guest?.phone ?? "").toLowerCase().includes(query) ||
        (r.room?.roomNumber ?? "").toLowerCase().includes(query) ||
        r.id.toLowerCase().includes(query)
      );
    });

    const byNewest = (a: Reservation, b: Reservation) =>
      dayOnly(b.checkOutDate).localeCompare(dayOnly(a.checkOutDate)) ||
      dayOnly(b.checkInDate).localeCompare(dayOnly(a.checkInDate));

    return rows.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return byNewest(b, a);
        case "highest":
          return Number(b.totalPrice) - Number(a.totalPrice) || byNewest(a, b);
        case "guest":
          return (
            (a.guest?.fullName ?? "").localeCompare(b.guest?.fullName ?? "") ||
            byNewest(a, b)
          );
        default:
          return byNewest(a, b);
      }
    });
  }, [history, search, period, from, to, payFilter, sort, today]);

  /* Stats follow the active filters, so they always describe what the table shows. */
  const stats = useMemo(() => {
    let billed = 0;
    let unpaid = 0;
    let unpaidCount = 0;
    let partialCount = 0;
    let nights = 0;
    for (const r of filtered) {
      const total = Number(r.totalPrice) || 0;
      billed += total;
      nights += nightsBetween(r.checkInDate, r.checkOutDate);
      const kind = payKindOf(r.paymentStatus);
      if (kind === "UNPAID") {
        unpaid += total;
        unpaidCount += 1;
      } else if (kind === "PARTIAL") {
        partialCount += 1;
      }
    }
    return {
      count: filtered.length,
      billed,
      unpaid,
      unpaidCount,
      partialCount,
      avgNights: filtered.length ? nights / filtered.length : 0,
    };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const activePage = Math.min(currentPage, totalPages);
  const pageRows = filtered.slice(
    (activePage - 1) * ITEMS_PER_PAGE,
    activePage * ITEMS_PER_PAGE,
  );

  const hasFilters =
    search.trim() !== "" || period !== "all" || payFilter !== "all";

  const resetPage = () => setCurrentPage(1);
  const clearFilters = () => {
    setSearch("");
    setPeriod("all");
    setFrom("");
    setTo("");
    setPayFilter("all");
    resetPage();
  };

  /* ---------- actions ---------- */

  const exportCsv = () => {
    const header = [
      "Guest",
      "Phone",
      "Room",
      "Check-in",
      "Check-out",
      "Nights",
      "Payment",
      "Total",
    ];
    const lines = filtered.map((r) =>
      [
        r.guest?.fullName ?? "",
        r.guest?.phone ?? "",
        r.room?.roomNumber ?? "",
        dayOnly(r.checkInDate),
        dayOnly(r.checkOutDate),
        nightsBetween(r.checkInDate, r.checkOutDate),
        PAY_LABEL[payKindOf(r.paymentStatus)],
        Number(r.totalPrice).toFixed(2),
      ]
        .map(csvCell)
        .join(","),
    );

    const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reservation-history-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch(`/api/v1/reservations/${toDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data?.error || data?.message || "Failed to delete reservation",
        );
      }

      setReservations((current) => current.filter((r) => r.id !== toDelete.id));
      setNotice(
        `Deleted the stay of ${toDelete.guest?.fullName ?? "the guest"} from history.`,
      );
      setToDelete(null);
    } catch (err) {
      console.error(err);
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete reservation",
      );
    } finally {
      setDeleting(false);
    }
  };

  /* ---------- UI ---------- */

  const userName = me?.fullName ?? "";

  return (
    <div className={styles.page}>
      <main className={styles.content} aria-busy={loading}>
        {/* HEADER */}
        <header className={styles.header}>
          <div className={styles.title}>
            <h1>Reservation history</h1>
            <p>
              {loading
                ? "Loading completed stays…"
                : `${history.length} completed ${history.length === 1 ? "stay" : "stays"} on record`}
            </p>
          </div>

          <div className={styles.userInfo}>
            <span className={styles.avatar} aria-hidden>
              {userName ? initialsOf(userName) : "–"}
            </span>
            <span className={styles.userText}>
              <strong>{userName || "…"}</strong>
              <small>{me ? titleCase(me.role) : ""}</small>
            </span>
          </div>
        </header>

        {/* STATS */}
        <section
          className={styles.stats}
          aria-label="Summary of the current results"
        >
          <div className={styles.stat}>
            <span>Completed stays</span>
            <strong>{stats.count}</strong>
            <small>
              {stats.count
                ? `${stats.avgNights.toFixed(1)} nights on average`
                : "No stays in this view"}
            </small>
          </div>
          <div className={styles.stat}>
            <span>Total billed</span>
            <strong>{formatMoney(stats.billed)}</strong>
            <small>Across the stays shown</small>
          </div>
          <div
            className={`${styles.stat} ${stats.unpaidCount ? styles.statWarn : ""}`}
          >
            <span>Unpaid</span>
            <strong>{formatMoney(stats.unpaid)}</strong>
            <small>
              {stats.unpaidCount} unpaid · {stats.partialCount} partial
            </small>
          </div>
        </section>

        {/* TOOLBAR */}
        <div className={styles.toolbar} role="search">
          <input
            className={styles.search}
            type="search"
            placeholder="Search guest, phone, room or ID"
            aria-label="Search history"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
          />

          <select
            className={styles.select}
            aria-label="Check-out period"
            value={period}
            onChange={(event) => {
              setPeriod(event.target.value as Period);
              resetPage();
            }}
          >
            <option value="all">All time</option>
            <option value="this_month">This month</option>
            <option value="last_30">Last 30 days</option>
            <option value="this_year">This year</option>
            <option value="custom">Custom range</option>
          </select>

          <select
            className={styles.select}
            aria-label="Payment status"
            value={payFilter}
            onChange={(event) => {
              setPayFilter(event.target.value as PayFilter);
              resetPage();
            }}
          >
            <option value="all">Any payment</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="UNPAID">Unpaid</option>
          </select>

          <select
            className={styles.select}
            aria-label="Sort by"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as SortKey);
              resetPage();
            }}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="highest">Highest total</option>
            <option value="guest">Guest A–Z</option>
          </select>

          <button
            className={styles.exportButton}
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            Export CSV
          </button>
        </div>

        {period === "custom" && (
          <div className={styles.range}>
            <label>
              Checked out from
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => {
                  setFrom(event.target.value);
                  resetPage();
                }}
              />
            </label>
            <label>
              to
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => {
                  setTo(event.target.value);
                  resetPage();
                }}
              />
            </label>
          </div>
        )}

        {/* MESSAGES */}
        {error && (
          <div className={styles.error} role="alert">
            <span>{error}</span>
            {expired ? (
              <a href="/login">Sign in</a>
            ) : (
              <button onClick={() => void loadData()}>Retry</button>
            )}
          </div>
        )}

        {/* RESULTS */}
        {loading ? (
          <div className={styles.skeletons} aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className={styles.skeleton} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <strong>
              {history.length === 0
                ? "No completed stays yet"
                : "Nothing matches these filters"}
            </strong>
            <p>
              {history.length === 0
                ? "Guests appear here after they check out."
                : "Try a different search, period or payment status."}
            </p>
            {hasFilters && (
              <button className={styles.ghostButton} onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Guest</th>
                    <th scope="col">Room</th>
                    <th scope="col">Stay</th>
                    <th scope="col">Payment</th>
                    <th scope="col" className={styles.num}>
                      Total
                    </th>
                    <th scope="col">
                      <span className={styles.srOnly}>Actions</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {pageRows.map((reservation) => {
                    const name = reservation.guest?.fullName || "Unknown guest";
                    const kind = payKindOf(reservation.paymentStatus);
                    const nights = nightsBetween(
                      reservation.checkInDate,
                      reservation.checkOutDate,
                    );

                    return (
                      <tr key={reservation.id}>
                        <td className={styles.guestCell}>
                          <span className={styles.avatar} aria-hidden>
                            {initialsOf(name)}
                          </span>
                          <span className={styles.guest}>
                            <strong>{name}</strong>
                            {reservation.guest?.phone && (
                              <small>{reservation.guest.phone}</small>
                            )}
                          </span>
                        </td>

                        <td data-label="Room">
                          <span className={styles.cellMain}>
                            Room {reservation.room?.roomNumber || "-"}
                          </span>
                          {reservation.room?.roomType && (
                            <small>{reservation.room.roomType}</small>
                          )}
                        </td>

                        <td data-label="Stay">
                          <span className={styles.cellMain}>
                            {formatDate(reservation.checkInDate)} →{" "}
                            {formatDate(reservation.checkOutDate)}
                          </span>
                          <small>
                            {nights} {nights === 1 ? "night" : "nights"}
                          </small>
                        </td>

                        <td data-label="Payment">
                          <span
                            className={`${styles.pill} ${
                              kind === "PAID"
                                ? styles.paid
                                : kind === "PARTIAL"
                                  ? styles.partial
                                  : styles.unpaid
                            }`}
                          >
                            {PAY_LABEL[kind]}
                          </span>
                        </td>

                        <td data-label="Total" className={styles.num}>
                          <span className={styles.cellMain}>
                            {formatMoney(reservation.totalPrice)}
                          </span>
                        </td>

                        <td className={styles.actions}>
                          <button
                            className={styles.deleteButton}
                            onClick={() => {
                              setDeleteError("");
                              setToDelete(reservation);
                            }}
                            aria-label={`Delete the stay of ${name}`}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* REUSABLE PAGINATION COMPONENT */}
            <Pagination
              currentPage={activePage}
              totalPages={totalPages}
              totalItems={filtered.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </>
        )}

        {toDelete && (
          <ConfirmDelete
            reservation={toDelete}
            busy={deleting}
            error={deleteError}
            onCancel={() => !deleting && setToDelete(null)}
            onConfirm={confirmDelete}
          />
        )}

        <div className={styles.toast} role="status" aria-live="polite">
          {notice}
        </div>
      </main>
    </div>
  );
}

/*
 * ================================
 * DELETE CONFIRMATION
 * ================================
 *
 * Native <dialog>: focus trap, Esc to close and an inert background come for free.
 */

function ConfirmDelete({
  reservation,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  reservation: Reservation;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const kind = payKindOf(reservation.paymentStatus);
  const name = reservation.guest?.fullName || "Unknown guest";

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="delete-title"
      onClose={onCancel}
      onCancel={(event) => busy && event.preventDefault()}
      onClick={(event) =>
        event.target === ref.current && !busy && ref.current?.close()
      }
    >
      <div className={styles.dialogBody}>
        <h2 id="delete-title">Delete this stay from history?</h2>

        <dl className={styles.summary}>
          <div>
            <dt>Guest</dt>
            <dd>{name}</dd>
          </div>
          <div>
            <dt>Room</dt>
            <dd>{reservation.room?.roomNumber || "-"}</dd>
          </div>
          <div>
            <dt>Stay</dt>
            <dd>
              {formatDate(reservation.checkInDate)} →{" "}
              {formatDate(reservation.checkOutDate)}
            </dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>
              {formatMoney(reservation.totalPrice)} · {PAY_LABEL[kind]}
            </dd>
          </div>
        </dl>

        <p className={styles.dialogText}>
          The record is removed permanently and will no longer count towards
          totals or reports. This can’t be undone.
        </p>

        {kind !== "PAID" && (
          <p className={styles.dialogWarn}>
            This stay is <strong>{PAY_LABEL[kind].toLowerCase()}</strong>.
            Deleting it also discards the outstanding balance.
          </p>
        )}

        {error && (
          <p className={styles.dialogError} role="alert">
            {error}
          </p>
        )}
      </div>

      <div className={styles.dialogActions}>
        <button
          className={styles.cancelButton}
          onClick={() => ref.current?.close()}
          disabled={busy}
        >
          Keep it
        </button>
        <button
          className={styles.dangerButton}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Deleting…" : "Delete permanently"}
        </button>
      </div>
    </dialog>
  );
}
