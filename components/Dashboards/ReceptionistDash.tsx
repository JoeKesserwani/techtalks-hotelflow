"use client";

import React, { useCallback, useEffect, useState } from "react";
import styles from "./ReceptionistDash.module.css";
import { useAuth } from "../Auth/AuthProvider";
import Header from "../Header/Header";
import { ReservationsBoard } from "../Reservations/reservationBoard";
import { NewReservationDialog } from "../Reservations/newReservationDialog";
import { RoomAvailabilityChart } from "../Reservations/RoomAvailabilityChart";
import HousekeepingReview, {
  HousekeepingTask as ReviewHousekeepingTask,
} from "../Housekeeping/housekeepingApproval";
import type { Reservation, Room } from "../../app/Pages/Reservations/frontdesk";

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

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationRooms, setReservationRooms] = useState<Room[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(true);
  const [showNewReservation, setShowNewReservation] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
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

  const fetchDashboard = useCallback(async () => {
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
  }, []);

  const fetchReservations = useCallback(async () => {
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
      const allReservations: Reservation[] = Array.isArray(reservationsData)
        ? reservationsData
        : (reservationsData?.data ?? reservationsData?.reservations ?? []);
      const allRooms: Room[] = Array.isArray(roomsData)
        ? roomsData
        : (roomsData?.data ?? roomsData?.rooms ?? []);
      const todaysReservations = allReservations.filter((r) => {
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
  }, [todayDate]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      fetchDashboard();
      fetchReservations();
    });
  }, [fetchDashboard, fetchReservations]);

  const showReservationToast = (message: string) => {
    setReservationToast(message);
    window.setTimeout(() => setReservationToast(""), 2500);
  };

  const openNewReservation = () => {
    setReservationToast("");
    setSelectedRoomId(null);
    setShowNewReservation(true);
  };

  const closeNewReservation = () => {
    setSelectedRoomId(null);
    setShowNewReservation(false);
  };

  const handleReservationCreated = (reservation: Reservation) => {
    setReservations((current) => [...current, reservation]);
    setSelectedRoomId(null);
    setShowNewReservation(false);
    showReservationToast("Reservation created successfully.");
    fetchDashboard();
    fetchReservations();
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

        <RoomAvailabilityChart
          rooms={reservationRooms}
          reservations={reservations}
          date={todayDate}
          today={todayDate}
          onSelectRoom={(roomId) => {
            setSelectedRoomId(roomId);
            setShowNewReservation(true);
          }}
        />

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
          initialRoomId={selectedRoomId ?? undefined}
          onClose={closeNewReservation}
          onCreated={handleReservationCreated}
          onConflict={fetchReservations}
        />
      )}
    </div>
  );
};

export default ReceptionistDash;
