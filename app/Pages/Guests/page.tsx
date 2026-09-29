"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AddGuestModal from "../../../components/AddGuestModal";
import Pagination from "../../../components/Pagination"; // Adjust path if using alias like "@/components/Pagination"
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
   * Reset to page 1 whenever search or filter changes.
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
   * Adjust page number if filtered items decrease below current page boundary.
   */
  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  /**
   * Get guests for current page.
   */
  const paginatedGuests = useMemo(() => {
    const startIndex = (currentPage - 1) * GUESTS_PER_PAGE;
    const endIndex = startIndex + GUESTS_PER_PAGE;

    return filteredGuests.slice(startIndex, endIndex);
  }, [filteredGuests, currentPage]);

  function goToPage(page: number) {
    if (page < 1 || page > totalPages || page === currentPage) {
      return;
    }

    setCurrentPage(page);

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
            maxLength={30}
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

          {/* AFTER (Single self-contained <Pagination /> component): */}
          {!isLoading && !error && filteredGuests.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={goToPage}
              totalItems={filteredGuests.length}
              itemsPerPage={GUESTS_PER_PAGE}
              isFiltered={Boolean(search.trim() || statusFilter !== "all")}
            />
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
