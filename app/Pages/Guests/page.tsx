"use client";

import { useEffect, useState } from "react";
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
  reservations: Reservation[]; // most recent one only, per the backend's `take: 1`
};

type StatusTone = "active" | "instay" | "cancelled" | "upcoming";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Derives the display label + color from the guest's latest reservation, if any.
function deriveStay(guest: Guest): {
  label: string;
  tone: StatusTone;
} {
  const latest = guest.reservations[0];
  if (!latest) return { label: "No reservations yet", tone: "active" };

  switch (latest.status) {
    case "CHECKED_IN":
      return {
        label: `Room ${latest.room.roomNumber} · In stay`,
        tone: "instay",
      };
    case "BOOKED":
      return {
        label: `Room ${latest.room.roomNumber} · Upcoming`,
        tone: "upcoming",
      };
    case "CANCELLED":
    case "NO_SHOW":
      return {
        label: `Room ${latest.room.roomNumber} · Cancelled`,
        tone: "cancelled",
      };
    case "CHECKED_OUT":
    default:
      return {
        label: `Room ${latest.room.roomNumber} · Completed`,
        tone: "active",
      };
  }
}

const AVATAR_COLORS = ["#4c5a3e", "#a15a3d", "#8a8f5c", "#c1573c"];

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

  const filteredGuests = guests.filter((g) =>
    g.fullName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className={styles.layout}>
      <main className={styles.main}>
        <header className={styles.topBar}>
          <div>
            <h2>Guests</h2>
            <p className={styles.subtitle}>{guests.length} guests</p>
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
          <button className={styles.filterButton} type="button">
            Filter by status
          </button>
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
              No guests yet — add your first one.
            </div>
          )}

          {!isLoading &&
            !error &&
            filteredGuests.map((guest, index) => {
              const stay = deriveStay(guest);
              return (
                <div className={styles.tableRow} key={guest.id}>
                  <div className={styles.guestCell}>
                    <span
                      className={styles.avatar}
                      style={{
                        background: AVATAR_COLORS[index % AVATAR_COLORS.length],
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
                      href={`/reservations/new?guestId=${guest.id}`}
                      className={styles.bookLink}
                    >
                      Book a room
                    </Link>
                  </div>
                </div>
              );
            })}
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
