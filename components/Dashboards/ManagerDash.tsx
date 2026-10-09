"use client";

import React from "react";
import styles from "./AdminDash.module.css";
import { useAuth } from "../Auth/AuthProvider";
import { useRouter } from "next/navigation";
import Header from "../Header/Header";
import HousekeepingReview, {
  HousekeepingTask,
} from "../Housekeeping/housekeepingApproval";

type RoomStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "OCCUPIED"
  | "IN_REVIEW"
  | "NEEDS_CLEANING"
  | "CLEANING"
  | "OUT_OF_SERVICE";

interface Room {
  id: string;
  roomNumber: string;
  roomType: string;
  updatedAt: string;
  status: RoomStatus;
}

const getRoomStatusLabel = (status: RoomStatus) => {
  switch (status) {
    case "AVAILABLE":
      return "Available";

    case "RESERVED":
      return "Reserved";

    case "OCCUPIED":
      return "Occupied";

    case "IN_REVIEW":
      return "In review";

    case "NEEDS_CLEANING":
      return "Needs cleaning";

    case "CLEANING":
      return "Cleaning in progress";

    case "OUT_OF_SERVICE":
      return "Out of service";

    default:
      return "Unknown";
  }
};

const ManagerDash = () => {
  const { user } = useAuth();
  const router = useRouter();

  // Dashboard statistics fetched from the backend API
  const [occupancy, setOccupancy] = React.useState<number | null>(null);
  const [arrivals, setArrivals] = React.useState<number | null>(null);
  const [departures, setDepartures] = React.useState<number | null>(null);
  const [awaitingApproval, setAwaitingApproval] = React.useState<number | null>(
    null,
  );

  // Stores the rooms returned from the dashboard API
  const [rooms, setRooms] = React.useState<Room[]>([]);

  // Stores housekeeping tasks waiting for manager approval
  // (UI and approve/reject actions live in <HousekeepingReview />)
  const [housekeepingReview, setHousekeepingReview] = React.useState<
    HousekeepingTask[]
  >([]);

  // Fetch dashboard data from the backend
  const fetchStats = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/v1/Dashboard/stats", { signal });

      if (response.status === 401) return;

      if (!response.ok) {
        throw new Error("Failed to fetch dashboard stats");
      }

      const data = await response.json();
      if (signal?.aborted) return;

      setOccupancy(data.occupancy ?? null);
      setArrivals(data.arrivals ?? null);
      setDepartures(data.departures ?? null);
      setAwaitingApproval(data.awaitingApproval ?? null);
      setHousekeepingReview(data.housekeepingReview ?? []);
      setRooms(data.rooms ?? []);
    } catch (error) {
      if (signal?.aborted) return;
      console.error("Failed to load dashboard stats:", error);
    }
  }, []);

  // Load data when the dashboard loads
  React.useEffect(() => {
    if (!user) return;

    const controller = new AbortController();

    fetchStats(controller.signal);

    return () => controller.abort();
  }, [user, fetchStats]);

  // After a task is approved / rejected
  const handleTaskReviewed = React.useCallback(
    async (task: HousekeepingTask) => {
      // Remove the reviewed task immediately
      setHousekeepingReview((prev) => prev.filter((t) => t.id !== task.id));

      // Update the approval counter immediately
      setAwaitingApproval((prev) =>
        prev !== null ? Math.max(0, prev - 1) : prev,
      );

      // Reload from the database so room statuses are up to date
      await fetchStats();
    },
    [fetchStats],
  );

  return (
    <div className={styles.dashboard}>
      <main className={styles.main}>
        {/* HEADER */}
        <Header
          title={"Hello, " + (user?.fullName || "there") + "!"}
          subtitle="Overview of hotel operations"
          userSubtitle={new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        />

        {/* DASHBOARD STATISTICS */}
        <section className={styles.statsGrid}>
          <article className={styles.statCard}>
            <strong className={styles.statValue}>
              {occupancy !== null ? `${occupancy}%` : "--"}
            </strong>
            <p className={styles.statLabel}>OCCUPANCY</p>
          </article>

          <article className={styles.statCard}>
            <strong className={styles.statValue}>
              {arrivals !== null ? arrivals : "--"}
            </strong>
            <p className={styles.statLabel}>ARRIVALS TODAY</p>
          </article>

          <article className={styles.statCard}>
            <strong className={styles.statValue}>
              {departures !== null ? departures : "--"}
            </strong>
            <p className={styles.statLabel}>DEPARTURES TODAY</p>
          </article>

          <article className={styles.statCard}>
            <strong className={`${styles.statValue} ${styles.awaitingValue}`}>
              {awaitingApproval !== null ? awaitingApproval : "--"}
            </strong>
            <p className={styles.statLabel}>AWAITING APPROVAL</p>
          </article>
        </section>

        {/* HOUSEKEEPING REVIEW (reusable component) */}
        <HousekeepingReview
          tasks={housekeepingReview}
          onTaskReviewed={handleTaskReviewed}
        />

        {/* ROOM STATUS */}
        <section className={styles.roomStatusSection}>
          <div className={styles.sectionHeader}>
            <h2>Room Status — All floors</h2>
            <button
              className={styles.viewAll}
              onClick={() => router.push("/Pages/Rooms")}
            >
              View all
            </button>
          </div>

          <div className={styles.roomStatusGrid}>
            {rooms.slice(0, 10).map((room) => {
              let statusClass = styles.available;

              switch (room.status) {
                case "RESERVED":
                  statusClass = styles.reserved;
                  break;

                case "OCCUPIED":
                  statusClass = styles.occupied;
                  break;

                case "IN_REVIEW":
                  statusClass = styles.inReview;
                  break;

                case "NEEDS_CLEANING":
                  statusClass = styles.needsCleaning;
                  break;

                case "CLEANING":
                  statusClass = styles.cleaning;
                  break;

                case "OUT_OF_SERVICE":
                  statusClass = styles.outOfService;
                  break;

                case "AVAILABLE":
                default:
                  statusClass = styles.available;
                  break;
              }

              return (
                <div
                  key={room.id}
                  className={`${styles.roomStatusCard} ${statusClass}`}
                >
                  <strong>{room.roomNumber}</strong>

                  <span>{getRoomStatusLabel(room.status)}</span>
                </div>
              );
            })}
          </div>

          <div className={styles.roomStatusLegend}>
            <div>
              <span className={`${styles.legendDot} ${styles.availableDot}`} />
              Available
            </div>

            <div>
              <span className={`${styles.legendDot} ${styles.reservedDot}`} />
              Reserved
            </div>

            <div>
              <span className={`${styles.legendDot} ${styles.occupiedDot}`} />
              Occupied
            </div>

            <div>
              <span className={`${styles.legendDot} ${styles.cleaningDot}`} />
              Needs cleaning
            </div>

            <div>
              <span className={`${styles.legendDot} ${styles.approvalDot}`} />
              In review
            </div>

            <div>
              <span
                className={`${styles.legendDot} ${styles.cleaningProgressDot}`}
              />
              Cleaning
            </div>

            <div>
              <span
                className={`${styles.legendDot} ${styles.outOfServiceDot}`}
              />
              Out of service
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ManagerDash;
