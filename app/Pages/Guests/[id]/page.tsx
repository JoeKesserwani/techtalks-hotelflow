"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";
import Header from "@/components/Header/Header";

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
type GuestForm = {
  fullName: string;
  phone: string;
  email: string;
  passportNumber: string;
  note: string;
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
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState<GuestForm>({
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
    setForm({
      fullName: guest.fullName,
      phone: guest.phone ?? "",
      email: guest.email ?? "",
      passportNumber: guest.passportNumber ?? "",
      note: guest.note ?? "",
    });
    setSaveError(null);
    setIsEditing(true);
  }

  async function saveGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!guest) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/v1/guests/${guestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          passportNumber: form.passportNumber.trim() || null,
          note: form.note.trim() || null,
        }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setSaveError(
          result?.error ?? result?.message ?? "Could not update guest.",
        );
        return;
      }

      setGuest((current) => (current ? { ...current, ...result } : current));
      setIsEditing(false);
    } catch {
      setSaveError("Something went wrong. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={styles.layout}>
      <main className={styles.main}>
        <Link href="/Pages/Guests" className={styles.backLink}>
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
          Back to guests
        </Link>
        {Header({
          title: "Guests",
          subtitle:
            `Guests \u2192 ` + `${guest ? guest.fullName : "Loading..."}`,
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
                <div className={styles.profileIdentity}>
                  <div>
                    <h3>{guest.fullName}</h3>
                    <p className={styles.contactLine}>
                      {guest.phone ?? "No phone on file"} ·{" "}
                      {guest.email ?? "No email on file"}
                    </p>
                  </div>
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
                <form className={styles.editForm} onSubmit={saveGuest}>
                  <div className={styles.formGrid}>
                    <label className={styles.formField}>
                      Full name
                      <input
                        autoFocus
                        required
                        maxLength={150}
                        value={form.fullName}
                        onChange={(event) =>
                          setForm({ ...form, fullName: event.target.value })
                        }
                      />
                    </label>
                    <label className={styles.formField}>
                      Phone
                      <input
                        maxLength={30}
                        value={form.phone}
                        onChange={(event) =>
                          setForm({ ...form, phone: event.target.value })
                        }
                      />
                    </label>
                    <label className={styles.formField}>
                      Email
                      <input
                        type="email"
                        maxLength={254}
                        value={form.email}
                        onChange={(event) =>
                          setForm({ ...form, email: event.target.value })
                        }
                      />
                    </label>
                    <label className={styles.formField}>
                      Passport number
                      <input
                        maxLength={60}
                        value={form.passportNumber}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            passportNumber: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label
                      className={`${styles.formField} ${styles.formFieldWide}`}
                    >
                      Note
                      <textarea
                        rows={3}
                        maxLength={1000}
                        value={form.note}
                        onChange={(event) =>
                          setForm({ ...form, note: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  {saveError && (
                    <p className={styles.formError} role="alert">
                      {saveError}
                    </p>
                  )}
                  <div className={styles.formActions}>
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
                      type="submit"
                      className={styles.saveButton}
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                </form>
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
                <span>status</span>
              </div>

              {guest.reservations.length === 0 && (
                <div className={styles.stateText}>No reservations yet.</div>
              )}

              {guest.reservations.map((stay) => (
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
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
