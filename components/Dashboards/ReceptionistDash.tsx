"use client";

import React, { useEffect, useState } from "react";
import styles from "./ReceptionistDash.module.css";
import { useAuth } from "../Auth/AuthProvider";
import { useRouter } from "next/navigation";
import Header from "../Header/Header";
import { ReservationsBoard } from "../Reservations/reservationBoard";
import { NewReservationDialog } from "../Reservations/newReservationDialog";
import HousekeepingReview, {
  HousekeepingTask as ReviewHousekeepingTask,
} from "../Housekeeping/housekeepingApproval";

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

type HousekeepingAttentionTask = {
  id: string;
  status: string;
  completedAt?: string | null;
  photos?: unknown;
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
  housekeepingAttention: HousekeepingAttentionTask[];
};

// Reservations shown on the dashboard are limited to today.

const ReceptionistDash = () => {
  const { user } = useAuth();
  const router = useRouter();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
      photoUrl:
        Array.isArray(task.photos) && typeof task.photos[0] === "string"
          ? task.photos[0]
          : undefined,
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
          onConflict={fetchReservations}
        />
      )}
    </div>
  );
};

export default ReceptionistDash;
