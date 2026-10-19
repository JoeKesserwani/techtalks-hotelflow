"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";
import Header from "@/components/Header/Header";
import Pagination from "@/components/Pagination";

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
  if (status === "CHECKED_IN") return styles.pillInStay;
  if (status === "CANCELLED" || status === "NO_SHOW")
    return styles.pillCancelled;
  return styles.pillCompleted;
}

export default function GuestDetailPage() {
  const params = useParams();
  const guestId = params?.id as string;

  const [guest, setGuest] = useState<Guest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
const [currentPage, setCurrentPage] = useState(1);
const reservationsPerPage = 5;

const totalReservations = guest?.reservations.length ?? 0;
const totalPages = Math.ceil(totalReservations / reservationsPerPage);

const startIndex = (currentPage - 1) * reservationsPerPage;

const paginatedReservations =
  guest?.reservations.slice(
    startIndex,
    startIndex + reservationsPerPage,
  ) ?? [];
const [isEditing, setIsEditing] = useState(false);
const [isSaving, setIsSaving] = useState(false);
const [saveError, setSaveError] = useState<string | null>(null);

const [editForm, setEditForm] = useState({
  fullName: "",
  phone: "",
  email: "",
  passportNumber: "",
  note: "",
});

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
  function startEditing() {
  if (!guest) return;

  setEditForm({
    fullName: guest.fullName,
    phone: guest.phone ?? "",
    email: guest.email ?? "",
    passportNumber: guest.passportNumber ?? "",
    note: guest.note ?? "",
  });

  setSaveError(null);
  setIsEditing(true);
}

async function saveGuest() {
  if (!guest) return;

  if (!editForm.fullName.trim()) {
    setSaveError("Guest name is required.");
    return;
  }

  setIsSaving(true);
  setSaveError(null);

  try {
    const res = await fetch(`/api/v1/guests/${guest.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: editForm.fullName.trim(),
        phone: editForm.phone.trim() || null,
        email: editForm.email.trim() || null,
        passportNumber: editForm.passportNumber.trim() || null,
        note: editForm.note.trim() || null,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error ?? "Unable to update guest.");
    }

    setGuest((current) =>
      current ? { ...current, ...data } : current,
    );

    setIsEditing(false);
  } catch (err) {
    setSaveError(
      err instanceof Error ? err.message : "Unable to update guest.",
    );
  } finally {
    setIsSaving(false);
  }
}


  return (
    <div className={styles.layout}>
      <main className={styles.main}>
      
{Header({
          title: "Guests",
          subtitle: `Guests \u2192 `+ `${guest ? guest.fullName : "Loading..."}`,
          userSubtitle: "Checking guests",
        })}
        {isLoading && <p className={styles.stateText}>Loading guest...</p>}
        {!isLoading && error && <p className={styles.stateText}>{error}</p>}

        {!isLoading && !error && guest && (
          <>
            <section className={styles.profileCard}>
              <div className={styles.profileHeader}>
  <span className={styles.avatar}>
    {initials(guest.fullName)}
  </span>

  <div className={styles.profileInfo}>
    <h3>{guest.fullName}</h3>
    <p className={styles.contactLine}>
      {guest.phone ?? "No phone on file"} ·{" "}
      {guest.email ?? "No email on file"}
    </p>
  </div>

  {!isEditing && (
    <button
      type="button"
      className={styles.editButton}
      onClick={startEditing}
    >
      Edit guest
    </button>
  )}
</div>

             {isEditing ? (
  <div className={styles.editForm}>
    <label className={styles.formField}>
      Full name *
      <input
        value={editForm.fullName}
        onChange={(e) =>
          setEditForm({ ...editForm, fullName: e.target.value })
        }
        required
      />
    </label>

    <label className={styles.formField}>
      Phone
      <input
        type="tel"
        value={editForm.phone}
        onChange={(e) =>
          setEditForm({ ...editForm, phone: e.target.value })
        }
      />
    </label>

    <label className={styles.formField}>
      Email
      <input
        type="email"
        value={editForm.email}
        onChange={(e) =>
          setEditForm({ ...editForm, email: e.target.value })
        }
      />
    </label>

    <label className={styles.formField}>
      Passport number
      <input
        value={editForm.passportNumber}
        onChange={(e) =>
          setEditForm({ ...editForm, passportNumber: e.target.value })
        }
      />
    </label>

    <label className={`${styles.formField} ${styles.fullWidth}`}>
      Note
      <textarea
        rows={3}
        value={editForm.note}
        onChange={(e) =>
          setEditForm({ ...editForm, note: e.target.value })
        }
      />
    </label>

    {saveError && (
      <p className={styles.saveError}>{saveError}</p>
    )}

    <div className={styles.editActions}>
      <button
        type="button"
        className={styles.cancelButton}
        disabled={isSaving}
        onClick={() => {
          setIsEditing(false);
          setSaveError(null);
        }}
      >
        Cancel
      </button>

      <button
        type="button"
        className={styles.saveButton}
        disabled={isSaving}
        onClick={saveGuest}
      >
        {isSaving ? "Saving..." : "Save changes"}
      </button>
    </div>
  </div>
) : (
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
)}
            </section>

            <div className={styles.tableCard}>
  <div className={styles.tableHeaderRow}>
    <span>Dates</span>
    <span>Room</span>
    <span>Nights</span>
    <span>Status</span>
  </div>

  {totalReservations === 0 ? (
    <div className={styles.stateText}>
      No reservations yet.
    </div>
  ) : (
    paginatedReservations.map((stay) => (
      <div className={styles.tableRow} key={stay.id}>
        <span>
          {new Date(stay.checkInDate).toLocaleDateString()} &rarr;{" "}
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
    ))
  )}

  <Pagination
    currentPage={currentPage}
    totalPages={totalPages}
    onPageChange={setCurrentPage}
    totalItems={totalReservations}
    itemsPerPage={reservationsPerPage}
  />
</div>
            <div className={styles.backButtonContainer}>
              <button
                type="button"
                className={styles.backButton}
                onClick={() => router.push("/Pages/Guests")}
              >
                Back to guests
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
