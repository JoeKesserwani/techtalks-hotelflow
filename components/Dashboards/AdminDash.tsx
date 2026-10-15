"use client";

import React from "react";
import styles from "./AdminDash.module.css";
import { useAuth } from "../Auth/AuthProvider";
import Header from "../Header/Header";
import HousekeepingReview, {
  HousekeepingTask,
} from "../Housekeeping/housekeepingApproval";
import { DashboardRoomAvailability } from "./DashboardRoomAvailability";

const AdminDash = () => {
  const { user } = useAuth();

  // --------------------------------------------------
  // DASHBOARD STATISTICS
  // --------------------------------------------------

  const [occupancy, setOccupancy] = React.useState<number | null>(null);
  const [arrivals, setArrivals] = React.useState<number | null>(null);
  const [departures, setDepartures] = React.useState<number | null>(null);
  const [awaitingApproval, setAwaitingApproval] = React.useState<number | null>(
    null,
  );

  // --------------------------------------------------
  // HOUSEKEEPING REVIEW (list only — UI/actions live in <HousekeepingReview />)
  // --------------------------------------------------

  const [housekeepingReview, setHousekeepingReview] = React.useState<
    HousekeepingTask[]
  >([]);

  // --------------------------------------------------
  // FETCH DASHBOARD DATA
  // --------------------------------------------------

  const fetchStats = React.useCallback(async () => {
    try {
      const response = await fetch("/api/v1/Dashboard/stats");

      if (!response.ok) {
        throw new Error("Failed to fetch dashboard stats");
      }

      const data = await response.json();

      setOccupancy(data.occupancy ?? null);
      setArrivals(data.arrivals ?? null);
      setDepartures(data.departures ?? null);
      setAwaitingApproval(data.awaitingApproval ?? null);
      setHousekeepingReview(data.housekeepingReview ?? []);
    } catch (error) {
      console.error("Failed to load dashboard stats:", error);
    }
  }, []);

  React.useEffect(() => {
    void Promise.resolve().then(fetchStats);
  }, [fetchStats]);

  // --------------------------------------------------
  // AFTER A TASK IS APPROVED / REJECTED
  //
  // Approve: Task IN_REVIEW -> DONE,    Room IN_REVIEW -> AVAILABLE
  // Reject:  Task IN_REVIEW -> PENDING, Room IN_REVIEW -> NEEDS_CLEANING
  // --------------------------------------------------

  const handleTaskReviewed = React.useCallback(
    async (task: HousekeepingTask) => {
      // Remove the reviewed task immediately from the current list.
      setHousekeepingReview((prev) => prev.filter((t) => t.id !== task.id));

      // Update the approval counter immediately.
      setAwaitingApproval((prev) =>
        prev !== null ? Math.max(0, prev - 1) : prev,
      );

      // Reload data from the database so the room status is updated.
      await fetchStats();
    },
    [fetchStats],
  );

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className={styles.dashboard}>
      <main className={styles.main}>
        <Header
          title={`Hello, ${user?.fullName}!`}
          subtitle={new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          userSubtitle={""}
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

        {/* ==================================================
            HOUSEKEEPING REVIEW (reusable component)
        ================================================== */}

        <HousekeepingReview
          tasks={housekeepingReview}
          onTaskReviewed={handleTaskReviewed}
        />

        {/* ==================================================
            ROOM STATUS
        ================================================== */}

        <section className={styles.roomStatusSection}>
          <DashboardRoomAvailability onReservationCreated={fetchStats} />
        </section>
      </main>
    </div>
  );
};

export default AdminDash;
