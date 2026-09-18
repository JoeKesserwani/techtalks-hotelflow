"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./page.module.css";

type Room = { roomNumber: string };

type Reservation = {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  status: "BOOKED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";
  room: Room;
};

type Guest = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  passportNumber: string | null;
  note: string | null;
  reservations: Reservation[];
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function nights(checkIn: string, checkOut: string) {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();

  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function statusLabel(status: Reservation["status"]) {
  switch (status) {
    case "CHECKED_IN":
      return "In stay";

    case "CANCELLED":
    case "NO_SHOW":
      return "Cancelled";

    case "BOOKED":
      return "Upcoming";

    case "CHECKED_OUT":
    default:
      return "Completed";
  }
}

function statusPillClass(
  status: Reservation["status"],
  styles: Record<string, string>,
) {
  if (status === "CHECKED_IN") {
    return styles.pillInStay;
  }

  if (status === "CANCELLED" || status === "NO_SHOW") {
    return styles.pillCancelled;
  }

  return styles.pillCompleted;
}

export default function GuestDetailPage() {
  const params = useParams();
  const guestId = params?.id as string;

  const [guest, setGuest] = useState<Guest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!guestId) return;

    async function loadGuest() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/v1/guests/${guestId}`);

        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Could not load guest");
          return;
        }

        setGuest(data);
      } catch {
        setError("Something went wrong loading this guest.");
      } finally {
        setIsLoading(false);
      }
    }

    loadGuest();
  }, [guestId]);

  return (
    <div className={styles.layout}>
      <main className={styles.main}>
        <header className={styles.topBar}>
          <div className={styles.headerLeft}>
            <Link
              href="/Pages/Guests"
              className={styles.backButton}
              aria-label="Back to guests"
            >
              <svg
                className={styles.backIcon}
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M19 12H5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 19L5 12L12 5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              <span>Back to Guests</span>
            </Link>

            <div className={styles.headerTitle}>
              <h2>Guest Details</h2>

              <p className={styles.breadcrumb}>
                Guests <span aria-hidden="true">→</span>{" "}
                {guest ? guest.fullName : "..."}
              </p>
            </div>
          </div>
        </header>

        {isLoading && <p className={styles.stateText}>Loading guest...</p>}

        {!isLoading && error && <p className={styles.stateText}>{error}</p>}

        {!isLoading && !error && guest && (
          <>
            <section className={styles.profileCard}>
              <div className={styles.profileHeader}>
                <span className={styles.avatar}>
                  {initials(guest.fullName)}
                </span>

                <div>
                  <h3>{guest.fullName}</h3>

                  <p className={styles.contactLine}>
                    {guest.phone ?? "No phone on file"} ·{" "}
                    {guest.email ?? "No email on file"}
                  </p>
                </div>
              </div>

              <div className={styles.detailsGrid}>
                <div>
                  <span className={styles.detailLabel}>Passport Number</span>

                  <span className={styles.detailValue}>
                    {guest.passportNumber ?? "—"}
                  </span>
                </div>

                <div>
                  <span className={styles.detailLabel}>Note</span>

                  <span className={styles.detailValue}>
                    {guest.note ?? "—"}
                  </span>
                </div>
              </div>
            </section>

            <div className={styles.tableCard}>
              <div className={styles.tableHeaderRow}>
                <span>Dates</span>
                <span>Room</span>
                <span>Nights</span>
                <span>Status</span>
              </div>

              {guest.reservations.length === 0 && (
                <div className={styles.stateText}>No reservations yet.</div>
              )}

              {guest.reservations.map((stay) => (
                <div className={styles.tableRow} key={stay.id}>
                  <span>
                    {new Date(stay.checkInDate).toLocaleDateString()} →{" "}
                    {new Date(stay.checkOutDate).toLocaleDateString()}
                  </span>

                  <span>
                    {stay.status === "CHECKED_IN"
                      ? `Currently in room ${stay.room.roomNumber}`
                      : `Room ${stay.room.roomNumber}`}
                  </span>

                  <span>{nights(stay.checkInDate, stay.checkOutDate)}</span>

                  <span>
                    <span className={statusPillClass(stay.status, styles)}>
                      {statusLabel(stay.status)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
