"use client";

import React from "react";
import styles from "./AdminDash.module.css";
import { useAuth } from "../Auth/AuthProvider";

interface Room {
  id: string;
  roomNumber: string;
  roomType: string;
  status: "AVAILABLE" | "RESERVED" | "OCCUPIED" | "NEEDS_CLEANING";
}

interface HousekeepingTask {
  id: string;
  room: {
    roomNumber: string;
    roomType: string;
  };
  assignedTo: {
    fullName: string;
  };
  completedAt: string;
  photoUrl?: string;
}

const AdminDash = () => {
  const { user } = useAuth();

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
  const [housekeepingReview, setHousekeepingReview] = React.useState<
    HousekeepingTask[]
  >([]);

  // Stores the housekeeping task currently selected by the manager
  const [selectedTask, setSelectedTask] =
    React.useState<HousekeepingTask | null>(null);

  // Form input states for modal actions
  const [commentText, setCommentText] = React.useState("");
  const [rejectionReason, setRejectionReason] = React.useState("");

  // Controls which housekeeping action popup is currently displayed
  const [activeModal, setActiveModal] = React.useState<
    "photo" | "comment" | "reject" | "approve" | "success" | null
  >(null);

  // Stores the type of result shown after an action is completed
  const [resultType, setResultType] = React.useState<
    "approved" | "rejected" | "comment" | null
  >(null);

  // Fetch real dashboard data from the backend when the dashboard loads
  React.useEffect(() => {
    const fetchStats = async () => {
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
        setRooms(data.rooms ?? []);
      } catch (error) {
        console.error("Failed to load dashboard stats:", error);
      }
    };

    fetchStats();
  }, []);

  // Modal Action Handlers
  const handleApprove = async () => {
    if (!selectedTask) return;
    // Optional: Call API to approve task here

    // Filter approved task out of list locally
    setHousekeepingReview((prev) =>
      prev.filter((t) => t.id !== selectedTask.id),
    );
    setResultType("approved");
    setActiveModal("success");
  };

  const handleReject = async () => {
    if (!selectedTask) return;
    // Optional: Call API with rejectionReason here

    // Filter rejected task out of list locally
    setHousekeepingReview((prev) =>
      prev.filter((t) => t.id !== selectedTask.id),
    );
    setResultType("rejected");
    setActiveModal("success");
  };

  const handleSendComment = async () => {
    if (!selectedTask) return;
    // Optional: Call API with commentText here

    setResultType("comment");
    setActiveModal("success");
  };

  const resetModalState = () => {
    setActiveModal(null);
    setSelectedTask(null);
    setResultType(null);
    setCommentText("");
    setRejectionReason("");
  };

  return (
    <div className={styles.dashboard}>
      <main className={styles.main}>
        {/* HEADER */}
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Hello, {user?.fullName}!</h1>

            <p className={styles.date} suppressHydrationWarning>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          <div className={styles.user}>
            <span className={styles.role}>{user?.role}</span>
          </div>
        </header>

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

        {/* HOUSEKEEPING REVIEW */}
        <section className={styles.housekeepingSection}>
          <div className={styles.sectionHeader}>
            <h2>Housekeeping — awaiting approval</h2>
            <button className={styles.viewAll}>View all</button>
          </div>

          <div className={styles.housekeepingList}>
            {housekeepingReview.length === 0 ? (
              <div className={styles.emptyMessage}>
                No housekeeping tasks awaiting approval.
              </div>
            ) : (
              housekeepingReview.map((task) => (
                <article key={task.id} className={styles.housekeepingCard}>
                  {/* Photo */}
                  <button
                    className={styles.photo}
                    onClick={() => {
                      setSelectedTask(task);
                      setActiveModal("photo");
                    }}
                  >
                    Photo
                  </button>

                  {/* Room information */}
                  <div className={styles.roomInfo}>
                    <h3>Room {task.room?.roomNumber}</h3>

                    <p>
                      {task.assignedTo?.fullName}
                      {" • "}
                      {task.completedAt
                        ? new Date(task.completedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "--"}
                      {" • "}
                      {task.room?.roomType}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className={styles.actions}>
                    <button
                      className={styles.commentButton}
                      onClick={() => {
                        setSelectedTask(task);
                        setActiveModal("comment");
                      }}
                    >
                      Comment
                    </button>

                    <button
                      className={styles.rejectButton}
                      onClick={() => {
                        setSelectedTask(task);
                        setActiveModal("reject");
                      }}
                    >
                      Reject
                    </button>

                    <button
                      className={styles.approveButton}
                      onClick={() => {
                        setSelectedTask(task);
                        setActiveModal("approve");
                      }}
                    >
                      Approve
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        {/* HOUSEKEEPING ACTION MODALS */}
        {activeModal && selectedTask && (
          <div className={styles.modalOverlay} onClick={resetModalState}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <button className={styles.modalClose} onClick={resetModalState}>
                ×
              </button>

              <h2>
                {activeModal === "photo" && "Housekeeping Photo"}
                {activeModal === "comment" && "Add Comment"}
                {activeModal === "reject" && "Reject Task"}
                {activeModal === "approve" && "Approve Task"}
                {activeModal === "success" && "Status Updated"}
              </h2>

              {activeModal !== "success" && (
                <p className={styles.modalRoom}>
                  Room {selectedTask.room?.roomNumber} •{" "}
                  {selectedTask.room?.roomType}
                </p>
              )}

              {/* Photo Modal */}
              {activeModal === "photo" && (
                <div className={styles.modalPhoto}>
                  {selectedTask.photoUrl ? (
                    <img
                      src={selectedTask.photoUrl}
                      alt={`Room ${selectedTask.room?.roomNumber}`}
                    />
                  ) : (
                    "Photo preview"
                  )}
                </div>
              )}

              {/* Comment Modal */}
              {activeModal === "comment" && (
                <>
                  <textarea
                    className={styles.modalTextarea}
                    placeholder="Write your comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />

                  <button
                    className={styles.sendCommentButton}
                    onClick={handleSendComment}
                  >
                    Send Comment
                  </button>
                </>
              )}

              {/* Reject Modal */}
              {activeModal === "reject" && (
                <>
                  <p className={styles.modalText}>
                    Are you sure you want to reject this housekeeping task?
                  </p>

                  <textarea
                    className={styles.modalTextarea}
                    placeholder="Reason for rejection..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />

                  <button
                    className={styles.modalRejectButton}
                    onClick={handleReject}
                  >
                    Reject Task
                  </button>
                </>
              )}

              {/* Approve Modal */}
              {activeModal === "approve" && (
                <>
                  <p className={styles.modalText}>
                    Are you sure you want to approve this housekeeping task?
                  </p>

                  <button
                    className={styles.modalApproveButton}
                    onClick={handleApprove}
                  >
                    Approve Task
                  </button>
                </>
              )}

              {/* Success Screen Modal */}
              {activeModal === "success" && (
                <>
                  <div
                    className={`${styles.resultIcon} ${
                      resultType === "approved"
                        ? styles.approvedIcon
                        : resultType === "rejected"
                          ? styles.rejectedIcon
                          : styles.commentIcon
                    }`}
                  >
                    {resultType === "rejected" ? "×" : "✓"}
                  </div>

                  <h3
                    className={`${styles.resultTitle} ${
                      resultType === "approved"
                        ? styles.approvedTitle
                        : resultType === "rejected"
                          ? styles.rejectedTitle
                          : styles.commentTitle
                    }`}
                  >
                    {resultType === "approved"
                      ? "Task Approved"
                      : resultType === "rejected"
                        ? "Task Rejected"
                        : "Comment Sent"}
                  </h3>

                  <p className={styles.modalSuccessText}>
                    {resultType === "approved"
                      ? "The housekeeping task has been approved."
                      : resultType === "rejected"
                        ? "The housekeeping task has been rejected."
                        : "Your comment has been sent to the cleaner."}
                  </p>

                  <button
                    className={
                      resultType === "rejected"
                        ? styles.modalRejectButton
                        : styles.modalApproveButton
                    }
                    onClick={resetModalState}
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ROOM STATUS */}
        <section className={styles.roomStatusSection}>
          <div className={styles.sectionHeader}>
            <h2>Room Status — All floors</h2>
            <button className={styles.viewAll}>View all</button>
          </div>

          <div className={styles.roomStatusGrid}>
            {rooms.map((room) => {
              let statusClass = styles.available;

              if (room.status === "RESERVED") {
                statusClass = styles.reserved;
              } else if (room.status === "OCCUPIED") {
                statusClass = styles.occupied;
              } else if (room.status === "NEEDS_CLEANING") {
                statusClass = styles.needsCleaning;
              }

              return (
                <div
                  key={room.id}
                  className={`${styles.roomStatusCard} ${statusClass}`}
                >
                  <strong>{room.roomNumber}</strong>

                  <span>
                    {room.status === "NEEDS_CLEANING"
                      ? "Needs cleaning"
                      : room.status
                        ? room.status.charAt(0) +
                          room.status.slice(1).toLowerCase()
                        : "Unknown"}
                  </span>
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
              Awaiting approval
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminDash;
