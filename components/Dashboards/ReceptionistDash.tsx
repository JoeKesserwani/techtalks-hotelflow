"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./ReceptionistDash.module.css";
import { useAuth } from "../Auth/AuthProvider";
import { useRouter } from "next/navigation";
import Header from "../Header/Header";
import { ReservationsBoard } from "../Reservations/reservationBoard";
import { NewReservationDialog } from "../Reservations/newReservationDialog";
import HousekeepingReview, {
  HousekeepingTask as ReviewHousekeepingTask,
} from "../Housekeeping/housekeepingApproval";
import type { Reservation, Room } from "../../app/Pages/Reservations/frontdesk";

type HousekeepingAttentionTask = {
  id: string;
  status: string;
  completedAt?: string | null;
  photos?: unknown;
  photoFiles: {
    id: string;
  }[];
  room: {
    id: string;
    roomNumber: string;
    roomType: string;
    status: string;
  };
  assignedTo: {
    id: string;
    fullName: string;
    role: string;
  };
};

type DashboardData = {
  success: boolean;
  message?: string;

  summary: {
    arrivalsToday: number;
    departuresToday: number;
    availableRooms: number;
  };

  roomStatus: {
    available: number;
    reserved: number;
    occupied: number;
    inReview: number;
    needsCleaning: number;
    cleaning: number;
    outOfService: number;
  };

  reservations: Reservation[];
  rooms: Room[];
  housekeepingAttention: HousekeepingAttentionTask[];
};

// Reservations shown on the dashboard are limited to today.

const ReceptionistDash = () => {
const { user } = useAuth();
const router = useRouter();

// --------------------------------------------------
// Dashboard state
// --------------------------------------------------

const [dashboard, setDashboard] =
useState<DashboardData | null>(null);

const [loading, setLoading] = useState(true);
const [error, setError] = useState("");

const [actionLoading, setActionLoading] =
useState<string | null>(null);

// --------------------------------------------------
// New Reservation state
// --------------------------------------------------

const [showNewReservation, setShowNewReservation] =
useState(false);

const [guests, setGuests] =
useState<Guest[]>([]);

const [rooms, setRooms] =
useState<Room[]>([]);

const [optionsLoading, setOptionsLoading] =
useState(false);

const [reservationSubmitting, setReservationSubmitting] =
useState(false);

const [reservationError, setReservationError] =
useState("");

const [reservationSuccess, setReservationSuccess] =
useState("");

const [selectedGuestId, setSelectedGuestId] =
useState("");

const [selectedRoomId, setSelectedRoomId] =
useState("");

const [checkInDate, setCheckInDate] =
useState("");

const [checkOutDate, setCheckOutDate] =
useState("");

const [paymentStatus, setPaymentStatus] =
useState<PaymentStatus>("UNPAID");

// --------------------------------------------------
// Dates
// --------------------------------------------------

const getHotelDate = (date = new Date()) => {
return new Intl.DateTimeFormat("en-CA", {
timeZone: "Asia/Beirut",
year: "numeric",
month: "2-digit",
day: "2-digit",
}).format(date);
};

const todayDate = getHotelDate();

const getNextDate = (dateString: string) => {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

const today = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Beirut",
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
}).format(new Date());

// --------------------------------------------------
// Fetch dashboard
// --------------------------------------------------

const fetchDashboard = async () => {
try {
setLoading(true);
setError("");


  const response = await fetch(
    "/api/v1/Dashboard/stats/Receptionist",
    {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message ||
        "Failed to load receptionist dashboard."
    );
  }

  setDashboard(data);
} catch (err) {
  console.error(
    "Receptionist dashboard error:",
    err
  );

  setError(
    err instanceof Error
      ? err.message
      : "Unable to load dashboard data."
  );
} finally {
  setLoading(false);
}


};

useEffect(() => {
fetchDashboard();
}, []);

// --------------------------------------------------
// Load guests and rooms
// --------------------------------------------------

const loadReservationOptions = async () => {
try {
setOptionsLoading(true);
setReservationError("");


  const [
    guestsResponse,
    roomsResponse,
  ] = await Promise.all([
    fetch("/api/v1/guests", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    }),

    fetch("/api/v1/rooms", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    }),
  ]);

  const guestsData =
    await guestsResponse.json();

  const roomsData =
    await roomsResponse.json();

  if (!guestsResponse.ok) {
    throw new Error(
      guestsData.message ||
        guestsData.error ||
        "Failed to load guests."
    );
  }

  if (!roomsResponse.ok) {
    throw new Error(
      roomsData.message ||
        roomsData.error ||
        "Failed to load rooms."
    );
  }

  /*
   * Your current APIs return the arrays directly.
   *
   * Guests:
   * GET /api/v1/guests
   *
   * Rooms:
   * GET /api/v1/rooms
   */

  setGuests(
    Array.isArray(guestsData)
      ? guestsData
      : guestsData.data ?? []
  );

  setRooms(
    Array.isArray(roomsData)
      ? roomsData
      : roomsData.data ?? []
  );
} catch (err) {
  console.error(
    "Reservation options error:",
    err
  );

  setReservationError(
    err instanceof Error
      ? err.message
      : "Unable to load reservation options."
  );
} finally {
  setOptionsLoading(false);
}


};

// --------------------------------------------------
// Open reservation modal
// --------------------------------------------------

const openNewReservation = () => {
const localToday = getHotelDate();


setShowNewReservation(true);

setReservationError("");
setReservationSuccess("");

setSelectedGuestId("");
setSelectedRoomId("");

setCheckInDate(localToday);
setCheckOutDate(getNextDate(localToday));

setPaymentStatus("UNPAID");

/*
 * Load the options after opening the modal.
 * The modal itself does NOT depend on loading.
 */
loadReservationOptions();


};

// --------------------------------------------------
// Close reservation modal
// --------------------------------------------------

const closeNewReservation = () => {
if (reservationSubmitting) {
return;
}


setShowNewReservation(false);

setReservationError("");
setReservationSuccess("");

};

// --------------------------------------------------
// Create reservation
// --------------------------------------------------

const handleCreateReservation = async (
event: React.FormEvent<HTMLFormElement>
) => {
event.preventDefault();


setReservationError("");
setReservationSuccess("");

if (!selectedGuestId) {
  setReservationError(
    "Please select a guest."
  );
  return;
}

if (!selectedRoomId) {
  setReservationError(
    "Please select a room."
  );
  return;
}

if (!checkInDate) {
  setReservationError(
    "Please select a check-in date."
  );
  return;
}

if (!checkOutDate) {
  setReservationError(
    "Please select a check-out date."
  );
  return;
}

if (checkInDate < todayDate) {
  setReservationError(
    "Check-in date cannot be before today."
  );
  return;
}

if (checkOutDate <= checkInDate) {
  setReservationError(
    "Check-out date must be after check-in date."
  );
  return;
}

try {
  setReservationSubmitting(true);

  const response = await fetch(
    "/api/v1/reservations",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        roomId: selectedRoomId,
        guestId: selectedGuestId,
        checkInDate,
        checkOutDate,
        paymentStatus,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        data.error ||
        "Failed to create reservation."
    );
  }

  setReservationSuccess(
    "Reservation created successfully."
  );

  await fetchDashboard();

        setDashboard(data);
        setReservations(data.reservations);
        setReservationRooms(data.rooms);
      } catch (err) {
        console.error("Receptionist dashboard error:", err);
        setError(
          err instanceof Error ? err.message : "Unable to load dashboard data.",
        );
      } finally {
        setLoading(false);
        setReservationsLoading(false);
      }
    })();

    dashboardRequest.current = request;
    void request.finally(() => {
      if (dashboardRequest.current === request) {
        dashboardRequest.current = null;
      }
    });

    return request;
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const showReservationToast = (message: string) => {
    setReservationToast(message);
    window.setTimeout(() => setReservationToast(""), 2500);
  };

  const openNewReservation = () => {
    setReservationToast("");
    setShowNewReservation(true);
  };

  const closeNewReservation = () => setShowNewReservation(false);

  const handleReservationCreated = (reservation: Reservation) => {
    setReservations((current) => [...current, reservation]);
    setShowNewReservation(false);
    showReservationToast("Reservation created successfully.");
    fetchDashboard();
  };

  const handleReservationUpdate = (reservation: Reservation) => {
    setReservations((current) =>
      current.map((item) => (item.id === reservation.id ? reservation : item)),
    );
  };

  const handleReservationRemove = (id: string) => {
    setReservations((current) => current.filter((item) => item.id !== id));
  };

  // --------------------------------------------------
  // Format date
  // --------------------------------------------------

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // --------------------------------------------------
  // Check In
  // --------------------------------------------------

  const handleCheckIn = async (reservationId: string) => {
    try {
      setError("");

      const response = await fetch(
        `/api/v1/reservations/${reservationId}/check-in`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to check in reservation.");
      }

      await fetchDashboard();
    } catch (err) {
      console.error("Check-in error:", err);

      setError(
        err instanceof Error ? err.message : "Unable to check in reservation.",
      );
    }
  };

  // --------------------------------------------------
  // Check Out
  // --------------------------------------------------

  const handleCheckOut = async (reservationId: string) => {
    try {
      setError("");

      const response = await fetch(
        `/api/v1/reservations/${reservationId}/check-out`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to check out reservation.");
      }

      await fetchDashboard();
    } catch (err) {
      console.error("Check-out error:", err);

      setError(
        err instanceof Error ? err.message : "Unable to check out reservation.",
      );
    }
  };

  const housekeepingReviewTasks: ReviewHousekeepingTask[] = (
    dashboard?.housekeepingAttention ?? []
  )
    .filter((task) => task.status === "IN_REVIEW")
    .map((task) => ({
      id: task.id,
      room: {
        roomNumber: task.room.roomNumber,
        roomType: task.room.roomType,
      },
      assignedTo: { fullName: task.assignedTo.fullName },
      completedAt: task.completedAt ?? "",
      photos: task.photos,
      photoFiles: task.photoFiles,
    }));

  const handleHousekeepingReviewed = async () => {
    await fetchDashboard();
  };

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <div className={styles.page}>
      {" "}
      <main className={styles.main}>
        {/* Header */}
        {Header({
          title: "Hello, " + (user?.fullName || "there") + "!",
          subtitle: "Today's hotel operations",
          userSubtitle: today,
        })}
        {/* Error */}
        {error && (
          <div className={styles.sectionCard}>
            <p>{error}</p>
          </div>
        )}

        {/* Summary */}
        <section className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>ARRIVALS TODAY</span>

            <strong>
              {loading ? "—" : (dashboard?.summary.arrivalsToday ?? 0)}
            </strong>
          </div>

          <div className={styles.statCard}>
            <span className={styles.statLabel}>DEPARTURES TODAY</span>

            <strong>
              {loading ? "—" : (dashboard?.summary.departuresToday ?? 0)}
            </strong>
          </div>

          <div className={styles.statCard}>
            <span className={styles.statLabel}>AVAILABLE ROOMS</span>

            <strong>
              {loading ? "—" : (dashboard?.summary.availableRooms ?? 0)}
            </strong>
          </div>
        </section>

        {/* Today's Reservations */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Today&apos;s Reservations</h2>
              <p>Arriving, departing, and staying guests for today</p>
            </div>
            <button
              type="button"
              className={styles.viewButton}
              onClick={openNewReservation}
            >
              + New Reservation
            </button>
          </div>
          <ReservationsBoard
            date={todayDate}
            today={todayDate}
            items={reservations}
            rooms={reservationRooms}
            loading={reservationsLoading}
            onUpdate={handleReservationUpdate}
            onRemove={handleReservationRemove}
            onReload={fetchDashboard}
            onToast={showReservationToast}
          />
        </section>

        {/* Room Status */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Room Status</h2>

              <p>Current status of hotel rooms</p>
            </div>

            <button
              className={styles.viewButton}
              onClick={() => router.push("/Pages/Rooms")}
            >
              View all
            </button>
          </div>

          <div className={styles.roomStatusGrid}>
            <div className={styles.roomStatusItem}>
              <span>Available</span>

              <strong>
                {loading ? "—" : (dashboard?.roomStatus.available ?? 0)}
              </strong>
            </div>

            <div className={styles.roomStatusItem}>
              <span>Upcoming</span>

              <strong>
                {loading ? "—" : (dashboard?.roomStatus.reserved ?? 0)}
              </strong>
            </div>

            <div className={styles.roomStatusItem}>
              <span>In stay</span>

              <strong>
                {loading ? "—" : (dashboard?.roomStatus.occupied ?? 0)}
              </strong>
            </div>

            <div className={styles.roomStatusItem}>
              <span>Needs cleaning</span>

              <strong>
                {loading ? "—" : (dashboard?.roomStatus.needsCleaning ?? 0)}
              </strong>
            </div>

            <div className={styles.roomStatusItem}>
              <span>Cleaning</span>

              <strong>
                {loading ? "—" : (dashboard?.roomStatus.cleaning ?? 0)}
              </strong>
            </div>

            <div className={styles.roomStatusItem}>
              <span>In review</span>

              <strong>
                {loading ? "—" : (dashboard?.roomStatus.inReview ?? 0)}
              </strong>
            </div>

            <div className={styles.roomStatusItem}>
              <span>Out of service</span>

              <strong>
                {loading ? "—" : (dashboard?.roomStatus.outOfService ?? 0)}
              </strong>
            </div>
          </div>
        </section>

        <HousekeepingReview
          title="Housekeeping Attention"
          tasks={housekeepingReviewTasks}
          emptyMessage={
            loading
              ? "Loading housekeeping tasks..."
              : "No housekeeping tasks awaiting approval."
          }
          onTaskReviewed={handleHousekeepingReviewed}
        />
      </main>
      {reservationToast && (
        <div className={styles.sectionCard} role="status">
          <p>{reservationToast}</p>
        </div>
      )}
      {showNewReservation && (
        <NewReservationDialog
          defaultDate={todayDate}
          today={todayDate}
          rooms={reservationRooms}
          reservations={reservations}
          onClose={closeNewReservation}
          onCreated={handleReservationCreated}
          onConflict={fetchDashboard}
        />
      )}
    </div>
  );
};

export default ReceptionistDash;
