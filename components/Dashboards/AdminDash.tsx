"use client";

import React from "react";
import styles from "./AdminDash.module.css";
import { useAuth } from "../Auth/AuthProvider";
import { useRouter } from "next/navigation";
import Header from "../Header/Header";

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
  const router = useRouter();

  // --------------------------------------------------
  // DASHBOARD STATISTICS
  // --------------------------------------------------

  const [occupancy, setOccupancy] = React.useState<number | null>(null);
  const [arrivals, setArrivals] = React.useState<number | null>(null);
  const [departures, setDepartures] = React.useState<number | null>(null);
  const [awaitingApproval, setAwaitingApproval] =
    React.useState<number | null>(null);

  // --------------------------------------------------
  // ROOMS
  // --------------------------------------------------

  const [rooms, setRooms] = React.useState<Room[]>([]);

  // --------------------------------------------------
  // HOUSEKEEPING REVIEW
  // --------------------------------------------------

  const [housekeepingReview, setHousekeepingReview] = React.useState<
    HousekeepingTask[]
  >([]);

  const [selectedTask, setSelectedTask] =
    React.useState<HousekeepingTask | null>(null);

  // --------------------------------------------------
  // MODAL FORM STATES
  // --------------------------------------------------

  const [commentText, setCommentText] = React.useState("");
  const [rejectionReason, setRejectionReason] = React.useState("");

  // Prevent duplicate approve/reject requests
  const [isUpdatingTask, setIsUpdatingTask] = React.useState(false);

  // Error shown inside approve/reject modal
  const [taskActionError, setTaskActionError] =
    React.useState<string | null>(null);

  // --------------------------------------------------
  // MODAL STATE
  // --------------------------------------------------

  const [activeModal, setActiveModal] = React.useState<
    "photo" | "comment" | "reject" | "approve" | "success" | null
  >(null);

  const [resultType, setResultType] = React.useState<
    "approved" | "rejected" | "comment" | null
  >(null);

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
      setRooms(data.rooms ?? []);
    } catch (error) {
      console.error("Failed to load dashboard stats:", error);
    }
  }, []);

  React.useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // --------------------------------------------------
  // APPROVE HOUSEKEEPING TASK
  // --------------------------------------------------

  const handleApprove = async () => {
    if (!selectedTask || isUpdatingTask) return;

    setIsUpdatingTask(true);
    setTaskActionError(null);

    try {
      let response = await fetch(
        `/api/v1/housekeeping/tasks/${selectedTask.id}/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "approve",
          }),
        },
      );

      // Refresh access token if necessary
      if (response.status === 401) {
        const refreshResponse = await fetch("/api/v1/auth/refresh", {
          method: "POST",
        });

        if (refreshResponse.ok) {
          response = await fetch(
            `/api/v1/housekeeping/tasks/${selectedTask.id}/review`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                action: "approve",
              }),
            },
          );
        }
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to approve housekeeping task.",
        );
      }

      // Remove the approved task immediately from the current list.
      setHousekeepingReview((prev) =>
        prev.filter((task) => task.id !== selectedTask.id),
      );

      // Update the approval counter immediately.
      setAwaitingApproval((prev) =>
        prev !== null ? Math.max(0, prev - 1) : prev,
      );

      // IMPORTANT:
      // Reload data from the database so the room status is updated.
      //
      // Backend:
      // Task IN_REVIEW -> DONE
      // Room IN_REVIEW -> AVAILABLE
      await fetchStats();

      setResultType("approved");
      setActiveModal("success");
    } catch (error) {
      setTaskActionError(
        error instanceof Error
          ? error.message
          : "Unable to approve housekeeping task.",
      );
    } finally {
      setIsUpdatingTask(false);
    }
  };

  // --------------------------------------------------
  // REJECT HOUSEKEEPING TASK
  // --------------------------------------------------

  const handleReject = async () => {
    if (!selectedTask || isUpdatingTask) return;

    const reason = rejectionReason.trim();

    if (!reason) {
      setTaskActionError("A reason is required before rejecting a task.");
      return;
    }

    setIsUpdatingTask(true);
    setTaskActionError(null);

    try {
      let response = await fetch(
        `/api/v1/housekeeping/tasks/${selectedTask.id}/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "reject",
            comment: reason,
          }),
        },
      );

      // Refresh access token if necessary
      if (response.status === 401) {
        const refreshResponse = await fetch("/api/v1/auth/refresh", {
          method: "POST",
        });

        if (refreshResponse.ok) {
          response = await fetch(
            `/api/v1/housekeeping/tasks/${selectedTask.id}/review`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                action: "reject",
                comment: reason,
              }),
            },
          );
        }
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to reject housekeeping task.",
        );
      }

      // Remove the rejected task from the review list.
      setHousekeepingReview((prev) =>
        prev.filter((task) => task.id !== selectedTask.id),
      );

      // Update the approval counter immediately.
      setAwaitingApproval((prev) =>
        prev !== null ? Math.max(0, prev - 1) : prev,
      );

      // IMPORTANT:
      // Reload data from the database so the room status is updated.
      //
      // Backend:
      // Task IN_REVIEW -> PENDING
      // Room IN_REVIEW -> NEEDS_CLEANING
      await fetchStats();

      setResultType("rejected");
      setActiveModal("success");
    } catch (error) {
      setTaskActionError(
        error instanceof Error
          ? error.message
          : "Unable to reject housekeeping task.",
      );
    } finally {
      setIsUpdatingTask(false);
    }
  };

  // --------------------------------------------------
  // SEND COMMENT
  // --------------------------------------------------

  const handleSendComment = async () => {
    if (!selectedTask) return;

    // Optional: connect this to a comments API later.

    setResultType("comment");
    setActiveModal("success");
  };

  // --------------------------------------------------
  // RESET MODAL
  // --------------------------------------------------

  const resetModalState = () => {
    if (isUpdatingTask) return;

    setActiveModal(null);
    setSelectedTask(null);
    setResultType(null);
    setCommentText("");
    setRejectionReason("");
    setTaskActionError(null);
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className={styles.dashboard}>
      <main className={styles.main}>
        {/* HEADER */}
       {/* <header className={styles.header}>
          <div>
            <h1 className={styles.title}>
              Hello, {user?.fullName}!
            </h1>

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
            <span className={styles.roleBadge}>
              {user?.role}
            </span>
          </div>
        </header>*/}
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

            <p className={styles.statLabel}>
              OCCUPANCY
            </p>
          </article>

          <article className={styles.statCard}>
            <strong className={styles.statValue}>
              {arrivals !== null ? arrivals : "--"}
            </strong>

            <p className={styles.statLabel}>
              ARRIVALS TODAY
            </p>
          </article>

          <article className={styles.statCard}>
            <strong className={styles.statValue}>
              {departures !== null ? departures : "--"}
            </strong>

            <p className={styles.statLabel}>
              DEPARTURES TODAY
            </p>
          </article>

          <article className={styles.statCard}>
            <strong
              className={`${styles.statValue} ${styles.awaitingValue}`}
            >
              {awaitingApproval !== null
                ? awaitingApproval
                : "--"}
            </strong>

            <p className={styles.statLabel}>
              AWAITING APPROVAL
            </p>
          </article>
        </section>

        {/* ==================================================
            HOUSEKEEPING REVIEW
        ================================================== */}

        <section className={styles.housekeepingSection}>
          <div className={styles.sectionHeader}>
            <h2>
              Housekeeping — awaiting approval
            </h2>

            <button
              className={styles.viewAll}
              onClick={() =>
                router.push("/Pages/HousekeepingReview")
              }
            >
              View all
            </button>
          </div>

          <div className={styles.housekeepingList}>
            {housekeepingReview.length === 0 ? (
              <div className={styles.emptyMessage}>
                No housekeeping tasks awaiting approval.
              </div>
            ) : (
              housekeepingReview.map((task) => (
                <article
                  key={task.id}
                  className={styles.housekeepingCard}
                >
                  {/* PHOTO */}

                  <button
                    className={styles.photo}
                    onClick={() => {
                      setSelectedTask(task);
                      setTaskActionError(null);
                      setActiveModal("photo");
                    }}
                  >
                    Photo
                  </button>

                  {/* ROOM INFORMATION */}

                  <div className={styles.roomInfo}>
                    <h3>
                      Room {task.room?.roomNumber}
                    </h3>

                    <p>
                      {task.assignedTo?.fullName}
                      {" • "}
                      {task.completedAt
                        ? new Date(
                            task.completedAt,
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "--"}
                      {" • "}
                      {task.room?.roomType}
                    </p>
                  </div>

                  {/* ACTIONS */}

                  <div className={styles.actions}>
                    <button
                      className={styles.rejectButton}
                      onClick={() => {
                        setSelectedTask(task);
                        setTaskActionError(null);
                        setRejectionReason("");
                        setActiveModal("reject");
                      }}
                    >
                      Reject
                    </button>

                    <button
                      className={styles.approveButton}
                      onClick={() => {
                        setSelectedTask(task);
                        setTaskActionError(null);
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

        {/* ==================================================
            HOUSEKEEPING ACTION MODALS
        ================================================== */}

        {activeModal && selectedTask && (
          <div
            className={styles.modalOverlay}
            onClick={resetModalState}
          >
            <div
              className={styles.modal}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}

              <button
                className={styles.modalClose}
                onClick={resetModalState}
                disabled={isUpdatingTask}
              >
                ×
              </button>

              {/* Modal title */}

              <h2>
                {activeModal === "photo" &&
                  "Housekeeping Photo"}

                {activeModal === "comment" &&
                  "Add Comment"}

                {activeModal === "reject" &&
                  "Reject Task"}

                {activeModal === "approve" &&
                  "Approve Task"}

                {activeModal === "success" &&
                  "Status Updated"}
              </h2>

              {/* Room information */}

              {activeModal !== "success" && (
                <p className={styles.modalRoom}>
                  Room {selectedTask.room?.roomNumber} •{" "}
                  {selectedTask.room?.roomType}
                </p>
              )}

              {/* ==================================================
                  PHOTO MODAL
              ================================================== */}

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

              {/* ==================================================
                  COMMENT MODAL
              ================================================== */}

              {activeModal === "comment" && (
                <>
                  <textarea
                    className={styles.modalTextarea}
                    placeholder="Write your comment..."
                    value={commentText}
                    onChange={(e) =>
                      setCommentText(e.target.value)
                    }
                  />

                  <button
                    className={styles.sendCommentButton}
                    onClick={handleSendComment}
                  >
                    Send Comment
                  </button>
                </>
              )}

              {/* ==================================================
                  REJECT MODAL
              ================================================== */}

              {activeModal === "reject" && (
                <>
                  <p className={styles.modalText}>
                    Are you sure you want to reject this
                    housekeeping task?
                  </p>

                  <textarea
                    className={styles.modalTextarea}
                    placeholder="Reason for rejection..."
                    value={rejectionReason}
                    onChange={(e) => {
                      setRejectionReason(e.target.value);
                      setTaskActionError(null);
                    }}
                    disabled={isUpdatingTask}
                  />

                  {taskActionError && (
                    <p className={styles.errorMessage}>
                      {taskActionError}
                    </p>
                  )}

                  <button
                    className={styles.modalRejectButton}
                    onClick={handleReject}
                    disabled={isUpdatingTask}
                  >
                    {isUpdatingTask
                      ? "Rejecting..."
                      : "Reject Task"}
                  </button>
                </>
              )}

              {/* ==================================================
                  APPROVE MODAL
              ================================================== */}

              {activeModal === "approve" && (
                <>
                  <p className={styles.modalText}>
                    Are you sure you want to approve this
                    housekeeping task?
                  </p>

                  {taskActionError && (
                    <p className={styles.errorMessage}>
                      {taskActionError}
                    </p>
                  )}

                  <button
                    className={styles.modalApproveButton}
                    onClick={handleApprove}
                    disabled={isUpdatingTask}
                  >
                    {isUpdatingTask
                      ? "Approving..."
                      : "Approve Task"}
                  </button>
                </>
              )}

              {/* ==================================================
                  SUCCESS MODAL
              ================================================== */}

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
                    {resultType === "rejected"
                      ? "×"
                      : "✓"}
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

        {/* ==================================================
            ROOM STATUS
        ================================================== */}

        <section className={styles.roomStatusSection}>
          <div className={styles.sectionHeader}>
            <h2>
              Room Status — All floors
            </h2>

            <button
              className={styles.viewAll}
              onClick={() =>
                router.push("/Pages/Rooms")
              }
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
                  <strong>
                    {room.roomNumber}
                  </strong>

                  <span>
                    {getRoomStatusLabel(room.status)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ==================================================
              ROOM STATUS LEGEND
          ================================================== */}

          <div className={styles.roomStatusLegend}>
            <div>
              <span
                className={`${styles.legendDot} ${styles.availableDot}`}
              />
              Available
            </div>

            <div>
              <span
                className={`${styles.legendDot} ${styles.reservedDot}`}
              />
              Reserved
            </div>

            <div>
              <span
                className={`${styles.legendDot} ${styles.occupiedDot}`}
              />
              Occupied
            </div>

            <div>
              <span
                className={`${styles.legendDot} ${styles.cleaningDot}`}
              />
              Needs cleaning
            </div>

            <div>
              <span
                className={`${styles.legendDot} ${styles.approvalDot}`}
              />
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

export default AdminDash;