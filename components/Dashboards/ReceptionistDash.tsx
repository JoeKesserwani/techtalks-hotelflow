"use client";

import React, { useEffect, useState } from "react";
import styles from "./ReceptionistDash.module.css";
import { useAuth } from "../Auth/AuthProvider";
import { useRouter } from "next/navigation";

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

const ReceptionistDash = () => {
const { user } = useAuth();
  const router = useRouter();


const [dashboard, setDashboard] = useState<DashboardData | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");
const [actionLoading, setActionLoading] = useState<string | null>(null);
const [awaitingApproval, setAwaitingApproval] = React.useState<number | null>(
    null,
  );

  

const today = new Date().toLocaleDateString("en-US", {
weekday: "long",
year: "numeric",
month: "long",
day: "numeric",
});

// --------------------------------------------------
// Fetch dashboard data
// --------------------------------------------------

const fetchDashboard = async () => {
try {
setLoading(true);
setError("");


  const response = await fetch(
    "/api/v1/Dashboard/stats/Receptionist"
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message || "Failed to load receptionist dashboard."
    );
  }

  setDashboard(data);
} catch (err) {
  console.error("Receptionist dashboard error:", err);
  setError("Unable to load dashboard data.");
} finally {
  setLoading(false);
}


};

useEffect(() => {
fetchDashboard();
}, []);

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
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to check in reservation."
    );
  }

  // Reload dashboard data so arrivals,
  // room status and summary update immediately.
  await fetchDashboard();
} catch (err) {
  console.error("Check-in error:", err);

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

const handleCheckOut = async (reservationId: string) => {
try {
setActionLoading(reservationId);
setError("");


  const response = await fetch(
    `/api/v1/reservations/${reservationId}/check-out`,
    {
      method: "POST",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to check out reservation."
    );
  }

  // Reload dashboard data so departures,
  // room status and summary update immediately.
  await fetchDashboard();
} catch (err) {
  console.error("Check-out error:", err);

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
// Render
// --------------------------------------------------

return ( <div className={styles.page}> <main className={styles.main}>

    {/* Header */}
    <header className={styles.header}>
      <div>
        <h1>Hello, {user?.fullName}!</h1>
        <p>Today&apos;s hotel operations</p>
      </div>

      <div className={styles.headerRight}>
        <span className={styles.date}>{today}</span>
        <span className={styles.roleBadge}>{user?.role}</span>
      </div>
    </header>

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
          {loading ? "—" : dashboard?.summary.arrivalsToday ?? 0}
        </strong>
      </div>

      <div className={styles.statCard}>
        <span className={styles.statLabel}>DEPARTURES TODAY</span>
        <strong>
          {loading ? "—" : dashboard?.summary.departuresToday ?? 0}
        </strong>
      </div>

      <div className={styles.statCard}>
        <span className={styles.statLabel}>AVAILABLE ROOMS</span>
        <strong>
          {loading ? "—" : dashboard?.summary.availableRooms ?? 0}
        </strong>
      </div>
    </section>

    {/* Arrivals + Quick Actions */}
    <section className={styles.contentGrid}>

      {/* Today's Arrivals */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Today&apos;s Arrivals</h2>
            <p>Guests expected to check in today</p>
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
              <span>No arrivals today</span>
            </div>
          ) : (
            dashboard?.arrivals.map((arrival) => (
              <div
                className={styles.tableRow}
                key={arrival.id}
              >
                <span>{arrival.guest.fullName}</span>

                <span>{arrival.room.roomNumber}</span>

                <span>
                  {formatDate(arrival.checkInDate)}
                </span>

                <span className={styles.pendingStatus}>
                  {arrival.status === "BOOKED"
                    ? "Booked"
                    : arrival.status}
                </span>

                <button
                  className={styles.actionButton}
                  onClick={() => handleCheckIn(arrival.id)}
                  disabled={actionLoading === arrival.id}
                >
                  {actionLoading === arrival.id
                    ? "Checking in..."
                    : "Check in"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Quick Actions</h2>
            <p>Common reception tasks</p>
          </div>
        </div>

        <div className={styles.quickActions}>
          <button>New Reservation</button>
          <button>Check In</button>
          <button>Check Out</button>
          <button>Guest Lookup</button>
          <button>View Rooms</button>
        </div>
      </div>

    </section>

    {/* Today's Departures */}
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <div>
          <h2>Today&apos;s Departures</h2>
          <p>Guests expected to check out today</p>
        </div>

        <button className={styles.viewButton}>
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
            <span>No departures today</span>
          </div>
        ) : (
          dashboard?.departures.map((departure) => (
            <div
              className={styles.tableRow}
              key={departure.id}
            >
              <span>{departure.guest.fullName}</span>

              <span>{departure.room.roomNumber}</span>

              <span>
                {formatDate(departure.checkOutDate)}
              </span>

              <span
                className={
                  departure.status === "CHECKED_OUT"
                    ? styles.completedStatus
                    : styles.pendingStatus
                }
              >
                {departure.status === "CHECKED_IN"
                  ? "Staying"
                  : departure.status === "CHECKED_OUT"
                    ? "Checked out"
                    : departure.status}
              </span>

              <button
                className={styles.actionButton}
                onClick={() =>
                  departure.status === "CHECKED_IN"
                    ? handleCheckOut(departure.id)
                    : undefined
                }
                disabled={
                  departure.status === "CHECKED_IN" &&
                  actionLoading === departure.id
                }
              >
                {departure.status === "CHECKED_IN"
                  ? actionLoading === departure.id
                    ? "Checking out..."
                    : "Check out"
                  : "View"}
              </button>
            </div>
          ))
        )}
      </div>
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
            {loading
              ? "—"
              : dashboard?.roomStatus.available ?? 0}
          </strong>
        </div>

        <div className={styles.roomStatusItem}>
          <span>Upcoming</span>
          <strong>
            {loading
              ? "—"
              : dashboard?.roomStatus.reserved ?? 0}
          </strong>
        </div>

        <div className={styles.roomStatusItem}>
          <span>In stay</span>
          <strong>
            {loading
              ? "—"
              : dashboard?.roomStatus.occupied ?? 0}
          </strong>
        </div>

        <div className={styles.roomStatusItem}>
          <span>Needs cleaning</span>
          <strong>
            {loading
              ? "—"
              : dashboard?.roomStatus.needsCleaning ?? 0}
          </strong>
        </div>

        <div className={styles.roomStatusItem}>
          <span>Cleaning</span>
          <strong>
            {loading
              ? "—"
              : dashboard?.roomStatus.cleaning ?? 0}
          </strong>
        </div>

        <div className={styles.roomStatusItem}>
          <span>In review</span>
          <strong>
            {loading
              ? "—"
              : dashboard?.roomStatus.inReview ?? 0}
          </strong>
        </div>

        <div className={styles.roomStatusItem}>
          <span>Out of service</span>
          <strong>
            {loading
              ? "—"
              : dashboard?.roomStatus.outOfService ?? 0}
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
            <span>
              No housekeeping attention required
            </span>
          </div>
        ) : (
          dashboard?.housekeepingAttention.map((task) => (
            <div
              className={styles.tableRow}
              key={task.id}
            >
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
                    <button className={styles.approveButton}>
                      Approve
                    </button>

                    <button className={styles.rejectButton}>
                      Reject
                    </button>
                  </>
                ) : (
                  <button className={styles.actionButton}>
                    Assign Task
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>

  </main>
</div>


);
};

export default ReceptionistDash;
