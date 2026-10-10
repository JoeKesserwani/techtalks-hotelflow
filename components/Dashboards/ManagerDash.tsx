"use client";

import React from "react";
import styles from "./AdminDash.module.css";
import { useAuth } from "../Auth/AuthProvider";
import Header from "../Header/Header";
import HousekeepingReview, {
  HousekeepingTask,
} from "../Housekeeping/housekeepingApproval";
import { DashboardRoomAvailability } from "./DashboardRoomAvailability";

const ManagerDash = () => {
  const { user } = useAuth();

  // Dashboard statistics fetched from the backend API
  const [occupancy, setOccupancy] = React.useState<number | null>(null);
  const [arrivals, setArrivals] = React.useState<number | null>(null);
  const [departures, setDepartures] = React.useState<number | null>(null);
  const [awaitingApproval, setAwaitingApproval] = React.useState<number | null>(
    null,
  );

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
    } catch (error) {
      if (signal?.aborted) return;
      console.error("Failed to load dashboard stats:", error);
    }
  }, []);

  // Load data when the dashboard loads
  React.useEffect(() => {
    if (!user) return;

    const controller = new AbortController();

    void Promise.resolve().then(() => fetchStats(controller.signal));

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
          <DashboardRoomAvailability
            onReservationCreated={() => fetchStats()}
          />
        </section>
      </main>
    </div>
  );
};

export default ManagerDash;
