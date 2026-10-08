"use client";

import React, { useEffect, useState } from "react";
import styles from "./ReceptionistDash.module.css";
import { useAuth } from "../Auth/AuthProvider";
import { useRouter } from "next/navigation";
import Header from "../Header/Header";
import { ReservationsBoard } from "../Reservations/reservationBoard";
import { NewReservationDialog } from "../Reservations/newReservationDialog";

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

// Reservations shown on the dashboard are limited to today.

const ReceptionistDash = () => {
  const { user } = useAuth();
  const router = useRouter();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reservations, setReservations] = useState<any[]>([]);
  const [reservationRooms, setReservationRooms] = useState<any[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(true);
  const [showNewReservation, setShowNewReservation] = useState(false);
  const [reservationToast, setReservationToast] = useState("");

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
    const date = new Date(`${dateString}T00:00:00`);

    date.setDate(date.getDate() + 1);

    return date.toISOString().split("T")[0];
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // --------------------------------------------------
  // Fetch dashboard
  // --------------------------------------------------

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/v1/Dashboard/stats/Receptionist", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to load receptionist dashboard.",
        );
      }

      setDashboard(data);
    } catch (err) {
      console.error("Receptionist dashboard error:", err);

      setError(
        err instanceof Error ? err.message : "Unable to load dashboard data.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchReservations = async () => {
    try {
      setReservationsLoading(true);
      const [reservationsResponse, roomsResponse] = await Promise.all([
        fetch("/api/v1/reservations", {
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/v1/rooms", { credentials: "include", cache: "no-store" }),
      ]);
      const reservationsData = await reservationsResponse.json();
      const roomsData = await roomsResponse.json();
      if (!reservationsResponse.ok)
        throw new Error(
          reservationsData?.message ||
            reservationsData?.error ||
            "Failed to load reservations.",
        );
      if (!roomsResponse.ok)
        throw new Error(
          roomsData?.message || roomsData?.error || "Failed to load rooms.",
        );
      const allReservations = Array.isArray(reservationsData)
        ? reservationsData
        : (reservationsData?.data ?? reservationsData?.reservations ?? []);
      const allRooms = Array.isArray(roomsData)
        ? roomsData
        : (roomsData?.data ?? roomsData?.rooms ?? []);
      const todaysReservations = allReservations.filter((r: any) => {
        const checkIn = String(r?.checkInDate ?? "").slice(0, 10);
        const checkOut = String(r?.checkOutDate ?? "").slice(0, 10);
        return (
          checkIn === todayDate ||
          checkOut === todayDate ||
          (checkIn < todayDate && checkOut > todayDate)
        );
      });
      setReservations(todaysReservations);
      setReservationRooms(allRooms);
    } catch (err) {
      console.error("Receptionist reservations error:", err);
      setError(
        err instanceof Error ? err.message : "Unable to load reservations.",
      );
    } finally {
      setReservationsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchReservations();
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

  const handleReservationCreated = (reservation: any) => {
    setReservations((current) => [...current, reservation]);
    setShowNewReservation(false);
    showReservationToast("Reservation created successfully.");
    fetchDashboard();
    fetchReservations();
  };

  const handleReservationUpdate = (reservation: any) => {
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
  // Room status labels
  // --------------------------------------------------

  const getRoomStatusLabel = (status: string) => {
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

  const handleCheckIn = async (reservationId: string) => {
    try {
      setActionLoading(reservationId);
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
    } finally {
      setActionLoading(null);
    }
  };

  // --------------------------------------------------
  // Check Out
  // --------------------------------------------------

  const handleCheckOut = async (reservationId: string) => {
    try {
      setActionLoading(reservationId);
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
    } finally {
      setActionLoading(null);
    }
  };

  // --------------------------------------------------
  // Housekeeping Review
  // --------------------------------------------------

  const handleHousekeepingReview = async (
    taskId: string,
    action: "APPROVE" | "REJECT",
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
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            `Failed to ${action.toLowerCase()} housekeeping task.`,
        );
      }

      await fetchDashboard();
    } catch (err) {
      console.error("Housekeeping review error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update housekeeping task.",
      );
    } finally {
      setActionLoading(null);
    }
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
            onReload={fetchReservations}
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

        {/* Housekeeping Attention */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Housekeeping Attention</h2>

              <p>Rooms that need reception action</p>
            </div>

            <button
              className={styles.viewButton}
              onClick={() => router.push("/Pages/HousekeepingReview")}
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
            ) : dashboard?.housekeepingAttention.length === 0 ? (
              <div className={styles.tableRow}>
                <span>No housekeeping attention required</span>
              </div>
            ) : (
              dashboard?.housekeepingAttention.map((task) => (
                <div className={styles.tableRow} key={task.id}>
                  <span>{task.room.roomNumber}</span>

                  <span className={styles.pendingStatus}>
                    {task.status === "IN_REVIEW"
                      ? "In review"
                      : getRoomStatusLabel(task.room.status)}
                  </span>

                  <span>{task.assignedTo.fullName}</span>

                  <div className={styles.reviewActions}>
                    {task.status === "IN_REVIEW" ? (
                      <>
                        <button
                          className={styles.approveButton}
                          onClick={() =>
                            handleHousekeepingReview(task.id, "APPROVE")
                          }
                          disabled={actionLoading === task.id}
                        >
                          {actionLoading === task.id ? "..." : "Approve"}
                        </button>

                        <button
                          className={styles.rejectButton}
                          onClick={() =>
                            handleHousekeepingReview(task.id, "REJECT")
                          }
                          disabled={actionLoading === task.id}
                        >
                          {actionLoading === task.id ? "..." : "Reject"}
                        </button>
                      </>
                    ) : (
                      <button
                        className={styles.actionButton}
                        onClick={() => router.push("/Pages/HousekeepingReview")}
                      >
                        View
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
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
          onConflict={fetchReservations}
        />
      )}
    </div>
  );
};

export default ReceptionistDash;
