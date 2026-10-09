"use client";

import React, { useEffect, useState } from "react";
import styles from "./ReceptionistDash.module.css";
import { useAuth } from "../Auth/AuthProvider";
import { useRouter } from "next/navigation";
import Header from "../Header/Header";

type Arrival = {
id: string;
checkInDate: string;
status: string;
guest: {
id: string;
fullName: string;
phone: string | null;
};
room: {
id: string;
roomNumber: string;
roomType: string;
};
};

type Departure = {
id: string;
checkOutDate: string;
status: string;
guest: {
id: string;
fullName: string;
phone: string | null;
};
room: {
id: string;
roomNumber: string;
roomType: string;
};
};

type HousekeepingTask = {
id: string;
status: string;
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

arrivals: Arrival[];
departures: Departure[];
housekeepingAttention: HousekeepingTask[];
};

type Guest = {
id: string;
fullName: string;
phone: string | null;
email: string | null;
};

type Room = {
id: string;
roomNumber: string;
roomType: string;
floor: number;
capacity: number;
basePrice: string | number;
status: string;
};

type PaymentStatus =
| "UNPAID"
| "PARTIALLY_PAID"
| "PAID";

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

  setTimeout(() => {
    setShowNewReservation(false);
    setReservationSuccess("");
  }, 900);
} catch (err) {
  console.error(
    "Create reservation error:",
    err
  );

  setReservationError(
    err instanceof Error
      ? err.message
      : "Unable to create reservation."
  );
} finally {
  setReservationSubmitting(false);
}


};

// --------------------------------------------------
// Format date
// --------------------------------------------------

const formatDate = (dateString: string) => {
return new Date(dateString).toLocaleDateString(
"en-US",
{
month: "short",
day: "numeric",
year: "numeric",
}
);
};

// --------------------------------------------------
// Room status labels
// --------------------------------------------------

const getRoomStatusLabel = (
status: string
) => {
switch (status) {
case "AVAILABLE":
return "Available";


  case "RESERVED":
    return "Upcoming";

  case "OCCUPIED":
    return "In stay";

  case "IN_REVIEW":
    return "In review";

  case "NEEDS_CLEANING":
    return "Needs cleaning";

  case "CLEANING":
    return "Cleaning";

  case "OUT_OF_SERVICE":
    return "Out of service";

  default:
    return status;
}


};

// --------------------------------------------------
// Check In
// --------------------------------------------------

const handleCheckIn = async (
reservationId: string
) => {
try {
setActionLoading(reservationId);
setError("");


  const response = await fetch(
    `/api/v1/reservations/${reservationId}/check-in`,
    {
      method: "POST",
      credentials: "include",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Failed to check in reservation."
    );
  }

  await fetchDashboard();
} catch (err) {
  console.error(
    "Check-in error:",
    err
  );

  setError(
    err instanceof Error
      ? err.message
      : "Unable to check in reservation."
  );
} finally {
  setActionLoading(null);
}

};

// --------------------------------------------------
// Check Out
// --------------------------------------------------

const handleCheckOut = async (
reservationId: string
) => {
try {
setActionLoading(reservationId);
setError("");


  const response = await fetch(
    `/api/v1/reservations/${reservationId}/check-out`,
    {
      method: "POST",
      credentials: "include",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Failed to check out reservation."
    );
  }

  await fetchDashboard();
} catch (err) {
  console.error(
    "Check-out error:",
    err
  );

  setError(
    err instanceof Error
      ? err.message
      : "Unable to check out reservation."
  );
} finally {
  setActionLoading(null);
}


};

// --------------------------------------------------
// Housekeeping Review
// --------------------------------------------------

const handleHousekeepingReview = async (
taskId: string,
action: "APPROVE" | "REJECT"
) => {
try {
setActionLoading(taskId);
setError("");


  const response = await fetch(
    `/api/v1/housekeeping/tasks/${taskId}/review`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        action,
      }),
    }
  );

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Failed to ${action.toLowerCase()} housekeeping task.`
    );
  }

  await fetchDashboard();
} catch (err) {
  console.error(
    "Housekeeping review error:",
    err
  );

  setError(
    err instanceof Error
      ? err.message
      : "Unable to update housekeeping task."
  );
} finally {
  setActionLoading(null);
}


};

// --------------------------------------------------
// Render
// --------------------------------------------------

return ( <div className={styles.page}> <main className={styles.main}>


    {/* Header */}
    <Header
  title={`Hello, ${user?.fullName || "there"}!`}
  subtitle="Today's hotel operations"
  userSubtitle={today}
/>
    {/* Error */}
    {error && (
      <div className={styles.sectionCard}>
        <p>{error}</p>
      </div>
    )}

    {/* Summary */}
    <section className={styles.statsGrid}>
      <div className={styles.statCard}>
        <span className={styles.statLabel}>
          ARRIVALS TODAY
        </span>

        <strong>
          {loading
            ? "—"
            : dashboard?.summary
                .arrivalsToday ?? 0}
        </strong>
      </div>

      <div className={styles.statCard}>
        <span className={styles.statLabel}>
          DEPARTURES TODAY
        </span>

        <strong>
          {loading
            ? "—"
            : dashboard?.summary
                .departuresToday ?? 0}
        </strong>
      </div>

      <div className={styles.statCard}>
        <span className={styles.statLabel}>
          AVAILABLE ROOMS
        </span>

        <strong>
          {loading
            ? "—"
            : dashboard?.summary
                .availableRooms ?? 0}
        </strong>
      </div>
    </section>

    {/* Arrivals + Quick Actions */}
    <section className={styles.contentGrid}>

      {/* Today's Arrivals */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>
              Today&apos;s Arrivals
            </h2>

            <p>
              Guests expected to check in today
            </p>
          </div>
        </div>

        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <span>Guest</span>
            <span>Room</span>
            <span>Date</span>
            <span>Status</span>
            <span>Action</span>
          </div>

          {loading ? (
            <div className={styles.tableRow}>
              <span>Loading...</span>
            </div>
          ) : dashboard?.arrivals.length === 0 ? (
            <div className={styles.tableRow}>
              <span>
                No arrivals today
              </span>
            </div>
          ) : (
            dashboard?.arrivals.map(
              (arrival) => (
                <div
                  className={styles.tableRow}
                  key={arrival.id}
                >
                  <span>
                    {arrival.guest.fullName}
                  </span>

                  <span>
                    {arrival.room.roomNumber}
                  </span>

                  <span>
                    {formatDate(
                      arrival.checkInDate
                    )}
                  </span>

                  <span
                    className={
                      styles.pendingStatus
                    }
                  >
                    {arrival.status ===
                    "BOOKED"
                      ? "Booked"
                      : arrival.status}
                  </span>

                  <button
                    className={
                      styles.actionButton
                    }
                    onClick={() =>
                      handleCheckIn(
                        arrival.id
                      )
                    }
                    disabled={
                      actionLoading ===
                      arrival.id
                    }
                  >
                    {actionLoading ===
                    arrival.id
                      ? "Checking in..."
                      : "Check in"}
                  </button>
                </div>
              )
            )
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Quick Actions</h2>

            <p>
              Start a common reception action
            </p>
          </div>
        </div>

        <div className={styles.quickActions}>
          <button
            type="button"
            onClick={openNewReservation}
          >
            + New Reservation
          </button>
        </div>
      </div>
    </section>

    {/* Today's Departures */}
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <div>
          <h2>
            Today&apos;s Departures
          </h2>

          <p>
            Guests expected to check out today
          </p>
        </div>

        <button
          className={styles.viewButton}
          onClick={() =>
            router.push(
              "/Pages/Reservations"
            )
          }
        >
          View all
        </button>
      </div>

      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <span>Guest</span>
          <span>Room</span>
          <span>Date</span>
          <span>Status</span>
          <span>Action</span>
        </div>

        {loading ? (
          <div className={styles.tableRow}>
            <span>Loading...</span>
          </div>
        ) : dashboard?.departures.length === 0 ? (
          <div className={styles.tableRow}>
            <span>
              No departures today
            </span>
          </div>
        ) : (
          dashboard?.departures.map(
            (departure) => (
              <div
                className={styles.tableRow}
                key={departure.id}
              >
                <span>
                  {departure.guest.fullName}
                </span>

                <span>
                  {departure.room.roomNumber}
                </span>

                <span>
                  {formatDate(
                    departure.checkOutDate
                  )}
                </span>

                <span
                  className={
                    departure.status ===
                    "CHECKED_OUT"
                      ? styles.completedStatus
                      : styles.pendingStatus
                  }
                >
                  {departure.status ===
                  "CHECKED_IN"
                    ? "Staying"
                    : departure.status ===
                      "CHECKED_OUT"
                      ? "Checked out"
                      : departure.status}
                </span>

                <button
                  className={
                    styles.actionButton
                  }
                  onClick={() => {
  if (departure.status === "CHECKED_IN") {
    handleCheckOut(departure.id);
  } else {
    router.push("/Pages/Reservations");
  }
}}
                  disabled={
                    departure.status ===
                      "CHECKED_IN" &&
                    actionLoading ===
                      departure.id
                  }
                >
                  {departure.status ===
                  "CHECKED_IN"
                    ? actionLoading ===
                      departure.id
                      ? "Checking out..."
                      : "Check out"
                    : "View"}
                </button>
              </div>
            )
          )
        )}
      </div>
    </section>

    {/* Room Status */}
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <div>
          <h2>Room Status</h2>

          <p>
            Current status of hotel rooms
          </p>
        </div>

        <button
          className={styles.viewButton}
          onClick={() =>
            router.push(
              "/Pages/Rooms"
            )
          }
        >
          View all
        </button>
      </div>

      <div className={styles.roomStatusGrid}>

        <div className={styles.roomStatusItem}>
          <span>Available</span>

          <strong>
            {loading
              ? "—"
              : dashboard?.roomStatus
                  .available ?? 0}
          </strong>
        </div>

        <div className={styles.roomStatusItem}>
          <span>Upcoming</span>

          <strong>
            {loading
              ? "—"
              : dashboard?.roomStatus
                  .reserved ?? 0}
          </strong>
        </div>

        <div className={styles.roomStatusItem}>
          <span>In stay</span>

          <strong>
            {loading
              ? "—"
              : dashboard?.roomStatus
                  .occupied ?? 0}
          </strong>
        </div>

        <div className={styles.roomStatusItem}>
          <span>Needs cleaning</span>

          <strong>
            {loading
              ? "—"
              : dashboard?.roomStatus
                  .needsCleaning ?? 0}
          </strong>
        </div>

        <div className={styles.roomStatusItem}>
          <span>Cleaning</span>

          <strong>
            {loading
              ? "—"
              : dashboard?.roomStatus
                  .cleaning ?? 0}
          </strong>
        </div>

        <div className={styles.roomStatusItem}>
          <span>In review</span>

          <strong>
            {loading
              ? "—"
              : dashboard?.roomStatus
                  .inReview ?? 0}
          </strong>
        </div>

        <div className={styles.roomStatusItem}>
          <span>Out of service</span>

          <strong>
            {loading
              ? "—"
              : dashboard?.roomStatus
                  .outOfService ?? 0}
          </strong>
        </div>

      </div>
    </section>

    {/* Housekeeping Attention */}
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <div>
          <h2>
            Housekeeping Attention
          </h2>

          <p>
            Rooms that need reception action
          </p>
        </div>

        <button
          className={styles.viewButton}
          onClick={() =>
            router.push(
              "/Pages/HousekeepingReview"
            )
          }
        >
          View all
        </button>
      </div>

      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <span>Room</span>
          <span>Status</span>
          <span>Assigned To</span>
          <span>Action</span>
        </div>

        {loading ? (
          <div className={styles.tableRow}>
            <span>Loading...</span>
          </div>
        ) : dashboard?.housekeepingAttention
            .length === 0 ? (
          <div className={styles.tableRow}>
            <span>
              No housekeeping attention required
            </span>
          </div>
        ) : (
          dashboard?.housekeepingAttention.map(
            (task) => (
              <div
                className={styles.tableRow}
                key={task.id}
              >
                <span>
                  {task.room.roomNumber}
                </span>

                <span
                  className={
                    styles.pendingStatus
                  }
                >
                  {task.status ===
                  "IN_REVIEW"
                    ? "In review"
                    : getRoomStatusLabel(
                        task.room.status
                      )}
                </span>

                <span>
                  {task.assignedTo.fullName}
                </span>

                <div
                  className={
                    styles.reviewActions
                  }
                >
                  {task.status ===
                  "IN_REVIEW" ? (
                    <>
                      <button
                        className={
                          styles.approveButton
                        }
                        onClick={() =>
                          handleHousekeepingReview(
                            task.id,
                            "APPROVE"
                          )
                        }
                        disabled={
                          actionLoading ===
                          task.id
                        }
                      >
                        {actionLoading ===
                        task.id
                          ? "..."
                          : "Approve"}
                      </button>

                      <button
                        className={
                          styles.rejectButton
                        }
                        onClick={() =>
                          handleHousekeepingReview(
                            task.id,
                            "REJECT"
                          )
                        }
                        disabled={
                          actionLoading ===
                          task.id
                        }
                      >
                        {actionLoading ===
                        task.id
                          ? "..."
                          : "Reject"}
                      </button>
                    </>
                  ) : (
                    <button
                      className={
                        styles.actionButton
                      }
                      onClick={() =>
                        router.push(
                          "/Pages/HousekeepingReview"
                        )
                      }
                    >
                      View
                    </button>
                  )}
                </div>
              </div>
            )
          )
        )}
      </div>
    </section>

  </main>

  {/* =================================================
      New Reservation Modal
      ================================================= */}

  {showNewReservation && (
    <div
      className={styles.modalOverlay}
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          closeNewReservation();
        }
      }}
    >
      <form
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-reservation-title"
        onSubmit={handleCreateReservation}
      >

        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <div>
            <h2 id="new-reservation-title">
              New Reservation
            </h2>

            <p>
              Create a reservation for a guest.
            </p>
          </div>

          <button
            type="button"
            className={styles.modalClose}
            onClick={closeNewReservation}
            aria-label="Close new reservation"
            disabled={reservationSubmitting}
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>

          {/* Error */}
          {reservationError && (
            <div
              className={styles.modalError}
              role="alert"
            >
              {reservationError}
            </div>
          )}

          {/* Success */}
          {reservationSuccess && (
            <div
              className={styles.modalSuccess}
              role="status"
            >
              {reservationSuccess}
            </div>
          )}

          {/* Loading options */}
          {optionsLoading && (
            <div
              className={styles.modalLoading}
            >
              Loading guests and rooms...
            </div>
          )}

          {/* Guest */}
          <div className={styles.formField}>
            <label htmlFor="reservation-guest">
              Guest
            </label>

            <select
              id="reservation-guest"
              value={selectedGuestId}
              onChange={(event) =>
                setSelectedGuestId(
                  event.target.value
                )
              }
              disabled={
                optionsLoading ||
                reservationSubmitting
              }
              required
            >
              <option value="">
                Select a guest
              </option>

              {guests.map((guest) => (
                <option
                  key={guest.id}
                  value={guest.id}
                >
                  {guest.fullName}
                  {guest.phone
                    ? ` — ${guest.phone}`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Room */}
          <div className={styles.formField}>
            <label htmlFor="reservation-room">
              Room
            </label>

            <select
              id="reservation-room"
              value={selectedRoomId}
              onChange={(event) =>
                setSelectedRoomId(
                  event.target.value
                )
              }
              disabled={
                optionsLoading ||
                reservationSubmitting
              }
              required
            >
              <option value="">
                Select a room
              </option>

              {rooms
  .filter((room) => room.status === "AVAILABLE")
  .map((room) => (
    <option key={room.id} value={room.id}>
      Room {room.roomNumber} — {room.roomType} — {room.basePrice} / night
    </option>
  ))}
            </select>
          </div>

          {/* Dates */}
          <div className={styles.formRow}>

            {/* Check-in */}
            <div
              className={styles.formField}
            >
              <label htmlFor="reservation-checkin">
                Check-in
              </label>

              <input
                id="reservation-checkin"
                type="date"
                value={checkInDate}
                min={todayDate}
                onChange={(event) => {
                  const newCheckIn =
                    event.target.value;

                  setCheckInDate(
                    newCheckIn
                  );

                  /*
                   * If the current checkout
                   * is no longer valid,
                   * automatically move it
                   * to the next day.
                   */
                  if (
                    checkOutDate &&
                    checkOutDate <=
                      newCheckIn
                  ) {
                    setCheckOutDate(
                      getNextDate(
                        newCheckIn
                      )
                    );
                  }
                }}
                disabled={
                  reservationSubmitting
                }
                required
              />
            </div>

            {/* Check-out */}
            <div
              className={styles.formField}
            >
              <label htmlFor="reservation-checkout">
                Check-out
              </label>

              <input
                id="reservation-checkout"
                type="date"
                value={checkOutDate}
                min={
                  checkInDate
                    ? getNextDate(
                        checkInDate
                      )
                    : undefined
                }
                onChange={(event) =>
                  setCheckOutDate(
                    event.target.value
                  )
                }
                disabled={
                  reservationSubmitting ||
                  !checkInDate
                }
                required
              />
            </div>

          </div>

          {/* Payment */}
          <div className={styles.formField}>
            <label htmlFor="reservation-payment">
              Payment status
            </label>

            <select
              id="reservation-payment"
              value={paymentStatus}
              onChange={(event) =>
                setPaymentStatus(
                  event.target
                    .value as PaymentStatus
                )
              }
              disabled={
                reservationSubmitting
              }
            >
              <option value="UNPAID">
                Unpaid
              </option>

              <option value="PARTIALLY_PAID">
                Partially paid
              </option>

              <option value="PAID">
                Paid
              </option>
            </select>
          </div>

        </div>

        {/* Modal Footer */}
        <div className={styles.modalFooter}>

          <button
            type="button"
            className={styles.modalCancel}
            onClick={closeNewReservation}
            disabled={
              reservationSubmitting
            }
          >
            Cancel
          </button>

          <button
            type="submit"
            className={styles.modalPrimary}
            disabled={
              optionsLoading ||
              reservationSubmitting ||
              !selectedGuestId ||
              !selectedRoomId ||
              !checkInDate ||
              !checkOutDate
            }
          >
            {reservationSubmitting
              ? "Creating..."
              : "Create Reservation"}
          </button>

        </div>

      </form>
    </div>
  )}

</div>

);
};

export default ReceptionistDash;
