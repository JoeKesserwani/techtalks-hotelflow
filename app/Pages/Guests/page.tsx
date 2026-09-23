"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AddGuestModal from "../../../components/AddGuestModal";
import styles from "./page.module.css";

type Room = { roomNumber: string };

type Reservation = {
  id: string;
  status: "BOOKED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";
  room: Room;
};

type Guest = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  reservations: Reservation[];
};

type StatusTone = "active" | "instay" | "cancelled" | "upcoming";

type StatusFilter = "all" | "upcoming" | "instay" | "completed" | "cancelled";

const GUESTS_PER_PAGE = 5;

const AVATAR_COLORS = ["#4c5a3e", "#a15a3d", "#8a8f5c", "#c1573c"];

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "upcoming", label: "Upcoming" },
  { value: "instay", label: "In stay" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Derives the display label + color + a stable filter key from the guest's latest reservation.
function deriveStay(guest: Guest): {
  label: string;
  tone: StatusTone;
  statusKey: Exclude<StatusFilter, "all">;
} {
  const latest = guest.reservations[0];

  if (!latest) {
    return {
      label: "No reservations yet",
      tone: "active",
      statusKey: "completed",
    };
  }

  switch (latest.status) {
    case "CHECKED_IN":
      return {
        label: `Room ${latest.room.roomNumber} · In stay`,
        tone: "instay",
        statusKey: "instay",
      };

    case "BOOKED":
      return {
        label: `Room ${latest.room.roomNumber} · Upcoming`,
        tone: "upcoming",
        statusKey: "upcoming",
      };

    case "CANCELLED":
    case "NO_SHOW":
      return {
        label: `Room ${latest.room.roomNumber} · Cancelled`,
        tone: "cancelled",
        statusKey: "cancelled",
      };

    case "CHECKED_OUT":
    default:
      return {
        label: `Room ${latest.room.roomNumber} · Completed`,
        tone: "active",
        statusKey: "completed",
      };
  }
}

function statusClass(tone: StatusTone, styles: Record<string, string>) {
  switch (tone) {
    case "instay":
      return styles.pillInStay;

    case "cancelled":
      return styles.pillCancelled;

    case "upcoming":
      return styles.pillUpcoming;

    default:
      return styles.pillActive;
  }
}

/**
 * Creates a compact pagination list such as:
 *
 * [1] [2] [3] ... [9] [10]
 *
 * or:
 *
 * [1] ... [5] [6] [7] ... [20]
 */
function getPaginationItems(
  currentPage: number,
  totalPages: number,
): (number | "ellipsis-left" | "ellipsis-right")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis-right", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      "ellipsis-left",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "ellipsis-left",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis-right",
    totalPages,
  ];
}

export default function GuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [search, setSearch] = useState("");
  const [isAddGuestOpen, setIsAddGuestOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  async function loadGuests() {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/guests");
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not load guests");
        return;
      }

      setGuests(data);
    } catch {
      setError("Something went wrong loading guests.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadGuests();
  }, []);

  /**
   * Search + status filter guests.
   *
   * Search covers:
   * - Guest name
   * - Guest ID
   * - Phone
   * - Email
   * - Room number
   */
  const filteredGuests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return guests.filter((guest) => {
      const roomNumber = guest.reservations[0]?.room?.roomNumber ?? "";

      const matchesSearch =
        !query ||
        guest.fullName.toLowerCase().includes(query) ||
        guest.id.toLowerCase().includes(query) ||
        (guest.phone ?? "").toLowerCase().includes(query) ||
        (guest.email ?? "").toLowerCase().includes(query) ||
        roomNumber.toLowerCase().includes(query);

      if (!matchesSearch) {
        return false;
      }

      if (statusFilter === "all") {
        return true;
      }

      return deriveStay(guest).statusKey === statusFilter;
    });
  }, [guests, search, statusFilter]);

  /**
   * Reset to page 1 whenever the search or filter changes.
   *
   * This prevents situations where the user is on page 5,
   * filters down to only 2 results, and sees an empty page.
   */
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  /**
   * Calculate total pages based on the filtered results.
   */
  const totalPages = Math.max(
    1,
    Math.ceil(filteredGuests.length / GUESTS_PER_PAGE),
  );

  /**
   * If guests are removed or filtered and the current page
   * no longer exists, move back to the last available page.
   */
  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  /**
   * Get only the guests that belong to the current page.
   */
  const paginatedGuests = useMemo(() => {
    const startIndex = (currentPage - 1) * GUESTS_PER_PAGE;
    const endIndex = startIndex + GUESTS_PER_PAGE;

    return filteredGuests.slice(startIndex, endIndex);
  }, [filteredGuests, currentPage]);

  /**
   * Pagination numbers / ellipsis.
   */
  const paginationItems = useMemo(
    () => getPaginationItems(currentPage, totalPages),
    [currentPage, totalPages],
  );

  /**
   * Results range displayed below the table.
   */
  const rangeStart =
    filteredGuests.length === 0 ? 0 : (currentPage - 1) * GUESTS_PER_PAGE + 1;

  const rangeEnd = Math.min(
    currentPage * GUESTS_PER_PAGE,
    filteredGuests.length,
  );

  function goToPage(page: number) {
    if (page < 1 || page > totalPages || page === currentPage) {
      return;
    }

    setCurrentPage(page);

    // Smoothly bring the table back into view.
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  const activeFilterLabel =
    FILTER_OPTIONS.find((option) => option.value === statusFilter)?.label ??
    "Filter by status";

  return (
    <div className={styles.layout}>
      <main className={styles.main}>
        <header className={styles.topBar}>
          <div>
            <h2>Guests</h2>

            <p className={styles.subtitle}>
              {guests.length} {guests.length === 1 ? "guest" : "guests"}
            </p>
          </div>
        </header>

        <div className={styles.toolbar}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search by guest's name, id, room number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className={styles.filterWrapper}>
            <button
              className={styles.filterButton}
              type="button"
              onClick={() => setIsFilterOpen((open) => !open)}
              aria-haspopup="listbox"
              aria-expanded={isFilterOpen}
            >
              {activeFilterLabel}
              <span className={styles.filterCaret} aria-hidden="true">
                ▾
              </span>
            </button>

            {isFilterOpen && (
              <>
                {/* click-catcher to close the dropdown on outside click */}
                <div
                  className={styles.filterBackdrop}
                  onClick={() => setIsFilterOpen(false)}
                />
                <ul className={styles.filterMenu} role="listbox">
                  {FILTER_OPTIONS.map((option) => (
                    <li key={option.value}>
                      <button
                        type="button"
                        className={
                          option.value === statusFilter
                            ? styles.filterOptionActive
                            : styles.filterOption
                        }
                        onClick={() => {
                          setStatusFilter(option.value);
                          setIsFilterOpen(false);
                        }}
                        role="option"
                        aria-selected={option.value === statusFilter}
                      >
                        {option.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <button
            className={styles.addButton}
            type="button"
            onClick={() => setIsAddGuestOpen(true)}
          >
            Add New Guest
          </button>
        </div>

        <div className={styles.tableCard}>
          <div className={styles.tableHeaderRow}>
            <span>Guest</span>
            <span>Contact</span>
            <span>Current stay</span>
            <span></span>
          </div>

          {isLoading && (
            <div className={styles.stateRow}>Loading guests...</div>
          )}

          {!isLoading && error && (
            <div className={styles.stateRow}>{error}</div>
          )}

          {!isLoading && !error && filteredGuests.length === 0 && (
            <div className={styles.stateRow}>
              {search.trim() || statusFilter !== "all"
                ? "No guests match your search or filter."
                : "No guests yet — add your first one."}
            </div>
          )}

          {!isLoading &&
            !error &&
            paginatedGuests.map((guest, index) => {
              const stay = deriveStay(guest);

              /**
               * Use the absolute index within the full filtered
               * result so avatar colors don't restart on every page.
               */
              const absoluteIndex = (currentPage - 1) * GUESTS_PER_PAGE + index;

              return (
                <div className={styles.tableRow} key={guest.id}>
                  <div className={styles.guestCell}>
                    <span
                      className={styles.avatar}
                      style={{
                        background:
                          AVATAR_COLORS[absoluteIndex % AVATAR_COLORS.length],
                      }}
                    >
                      {initials(guest.fullName)}
                    </span>

                    <span className={styles.guestName}>{guest.fullName}</span>
                  </div>

                  <div className={styles.contactCell}>
                    {guest.phone ?? guest.email ?? "—"}
                  </div>

                  <div className={styles.stayCell}>
                    <span className={statusClass(stay.tone, styles)}>
                      {stay.label}
                    </span>
                  </div>

                  <div className={styles.actionsCell}>
                    <Link
                      href={`/Pages/Guests/${guest.id}`}
                      className={styles.viewLink}
                    >
                      View
                    </Link>

                    <Link
                      href={`/Pages/Reservations?guestId=${guest.id}`}
                      className={styles.bookLink}
                    >
                      Book a room
                    </Link>
                  </div>
                </div>
              );
            })}

          {!isLoading && !error && filteredGuests.length > 0 && (
            <div className={styles.pagination}>
              <div className={styles.paginationInfo}>
                <span>
                  Showing <strong>{rangeStart}</strong>
                  {"–"}
                  <strong>{rangeEnd}</strong> of{" "}
                  <strong>{filteredGuests.length}</strong>
                </span>

                {(search.trim() || statusFilter !== "all") && (
                  <span className={styles.searchResultLabel}>
                    Filtered results
                  </span>
                )}
              </div>

              {totalPages > 1 && (
                <nav
                  className={styles.paginationControls}
                  aria-label="Guests pagination"
                >
                  <button
                    type="button"
                    className={styles.paginationArrow}
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M15 18L9 12L15 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  <div className={styles.pageNumbers}>
                    {paginationItems.map((item) => {
                      if (
                        item === "ellipsis-left" ||
                        item === "ellipsis-right"
                      ) {
                        return (
                          <span
                            key={item}
                            className={styles.paginationEllipsis}
                            aria-hidden="true"
                          >
                            ···
                          </span>
                        );
                      }

                      const isActive = item === currentPage;

                      return (
                        <button
                          key={item}
                          type="button"
                          className={`${styles.pageButton} ${
                            isActive ? styles.pageButtonActive : ""
                          }`}
                          onClick={() => goToPage(item)}
                          aria-current={isActive ? "page" : undefined}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    className={styles.paginationArrow}
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M9 18L15 12L9 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </nav>
              )}
            </div>
          )}
        </div>
      </main>

      {isAddGuestOpen && (
        <AddGuestModal
          onClose={() => setIsAddGuestOpen(false)}
          onCreated={loadGuests}
        />
      )}
    </div>
  );
}
