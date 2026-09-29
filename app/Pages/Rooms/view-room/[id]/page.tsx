"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Navbars/navbar";
import { useParams, useRouter } from "next/navigation";
import styles from "./viewRoom.module.css";
import { useAuth } from "@/components/Auth/AuthProvider";

type RoomStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "OCCUPIED"
  | "NEEDS_CLEANING"
  | "CLEANING"
  | "OUT_OF_SERVICE";

type Room = {
  id: string;
  roomNumber: string;
  roomType: string;
  floor: number;
  capacity: number;
  basePrice: number;
  status: RoomStatus;
};

type StaffUser = {
  id: string;
  fullName: string;
  role: string;
};

/* -------------------------------------------------------------------------- */
/* Room Status                                                                */
/* -------------------------------------------------------------------------- */

function getRoomStatusLabel(status: RoomStatus) {
  switch (status) {
    case "AVAILABLE":
      return "Available";

    case "RESERVED":
      return "Reserved";

    case "OCCUPIED":
      return "Occupied";

    case "NEEDS_CLEANING":
      return "Needs cleaning";

    case "CLEANING":
      return "Cleaning";

    case "OUT_OF_SERVICE":
      return "Out of service";

    default:
      return status;
  }
}

function getStatusClass(status: RoomStatus) {
  switch (status) {
    case "AVAILABLE":
      return styles.availableStatus;

    case "RESERVED":
      return styles.reservedStatus;

    case "OCCUPIED":
      return styles.occupiedStatus;

    case "NEEDS_CLEANING":
    case "CLEANING":
      return styles.cleaningStatus;

    case "OUT_OF_SERVICE":
      return styles.outOfServiceStatus;

    default:
      return styles.availableStatus;
  }
}

/* -------------------------------------------------------------------------- */
/* View Room Page                                                             */
/* -------------------------------------------------------------------------- */

const ViewRoomPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const roomId = params.id as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [housekeepers, setHousekeepers] = useState<StaffUser[]>([]);
  const [selectedHousekeeperId, setSelectedHousekeeperId] = useState("");
  const [taskComment, setTaskComment] = useState("");
  const [isLoadingHousekeepers, setIsLoadingHousekeepers] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskSuccess, setTaskSuccess] = useState<string | null>(null);

  async function openTaskModal() {
    setIsTaskModalOpen(true);
    setTaskError(null);
    setTaskSuccess(null);

    if (housekeepers.length > 0) return;

    setIsLoadingHousekeepers(true);

    try {
      const response = await fetch("/api/v1/users");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load housekeepers.");
      }

      const availableHousekeepers = (data as StaffUser[]).filter(
        (staffUser) => staffUser.role === "HOUSEKEEPING",
      );
      setHousekeepers(availableHousekeepers);
      setSelectedHousekeeperId(availableHousekeepers[0]?.id ?? "");
    } catch (error) {
      setTaskError(
        error instanceof Error
          ? error.message
          : "Unable to load housekeepers.",
      );
    } finally {
      setIsLoadingHousekeepers(false);
    }
  }

  function closeTaskModal() {
    if (isSavingTask) return;
    setIsTaskModalOpen(false);
    setTaskError(null);
  }

  async function createTask() {
    if (!selectedHousekeeperId) {
      setTaskError("Select a housekeeper before assigning the task.");
      return;
    }

    setIsSavingTask(true);
    setTaskError(null);
    setTaskSuccess(null);

    try {
      const response = await fetch("/api/v1/housekeeping/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          assignedToUserId: selectedHousekeeperId,
          notes: taskComment.trim() || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to create the task.");
      }

      setTaskComment("");
      setTaskSuccess("Cleaning task assigned successfully.");
    } catch (error) {
      setTaskError(
        error instanceof Error ? error.message : "Unable to create the task.",
      );
    } finally {
      setIsSavingTask(false);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Load Room                                                                */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    async function loadRoom() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/v1/rooms/${roomId}`);

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load room.");
        }

        setRoom(data as Room);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to load room.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    if (roomId) {
      loadRoom();
    }
  }, [roomId]);

  /* ------------------------------------------------------------------------ */
  /* Loading                                                                  */
  /* ------------------------------------------------------------------------ */

  if (isLoading) {
    return (
      <div className={styles.page}>
       

        <main className={styles.main}>
          <div className={styles.loading}>
            Loading room...
          </div>
        </main>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Error                                                                    */
  /* ------------------------------------------------------------------------ */

  if (error || !room) {
    return (
      <div className={styles.page}>
        

        <main className={styles.main}>
          <header className={styles.header}>
            <div>
              <button
                type="button"
                className={styles.backButton}
                onClick={() => router.back()}
              >
                ← Back to Room Setup
              </button>

              <p className={styles.label}>ROOM DETAILS</p>

              <h1 className={styles.title}>
                Room Details
              </h1>

              <p className={styles.subtitle}>
                Unable to load the requested room.
              </p>
            </div>

            <div className={styles.role}>
              <div className={styles.roleInfo}>
                <strong>{user?.fullName}</strong>
                <span>Currently managing rooms</span>
              </div>

              <div className={styles.roleBadge}>
                {user?.role}
              </div>
            </div>
          </header>

          <section className={styles.errorCard}>
            <h2>Unable to load room</h2>

            <p>
              {error ?? "The requested room could not be found."}
            </p>

            <button
              type="button"
              className={styles.backAction}
              onClick={() => router.back()}
            >
              Back to Room Setup
            </button>
          </section>
        </main>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className={styles.page}>

      <main className={styles.main}>

        {/* ------------------------------------------------------------------ */}
        {/* Header                                                             */}
        {/* ------------------------------------------------------------------ */}

        <header className={styles.header}>

          <div className={styles.headerLeft}>

            <button
              type="button"
              className={styles.backButton}
              onClick={() => router.back()}
            >
              ← Back to Room Setup
            </button>

            <p className={styles.label}>
              ROOM DETAILS
            </p>

            <h1 className={styles.title}>
              Room {room.roomNumber}
            </h1>

            <p className={styles.subtitle}>
              {room.roomType} room
            </p>

          </div>

          <div className={styles.role}>

            <div className={styles.roleInfo}>
              <strong>
                {user?.fullName}
              </strong>

              <span>
                Currently managing rooms
              </span>
            </div>

            <div className={styles.roleBadge}>
              {user?.role}
            </div>

          </div>

        </header>

        {/* ------------------------------------------------------------------ */}
        {/* Status                                                              */}
        {/* ------------------------------------------------------------------ */}

        <section className={styles.statusSection}>

          <div>
            <p className={styles.cardLabel}>
              CURRENT STATUS
            </p>

            <h2 className={styles.statusTitle}>
              {getRoomStatusLabel(room.status)}
            </h2>
          </div>

          <span className={getStatusClass(room.status)}>
            {getRoomStatusLabel(room.status)}
          </span>

        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Room Information                                                   */}
        {/* ------------------------------------------------------------------ */}

        <section className={styles.detailsCard}>

          <div className={styles.cardHeader}>

            <div>
              <p className={styles.cardLabel}>
                ROOM SETUP
              </p>

              <h2>
                Room Information
              </h2>
            </div>

          </div>

          <div className={styles.detailsGrid}>

            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>
                Room number
              </span>

              <strong>
                {room.roomNumber}
              </strong>
            </div>

            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>
                Room type
              </span>

              <strong>
                {room.roomType}
              </strong>
            </div>

            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>
                Floor
              </span>

              <strong>
                {room.floor}
              </strong>
            </div>

            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>
                Capacity
              </span>

              <strong>
                {room.capacity}{" "}
                {room.capacity === 1 ? "guest" : "guests"}
              </strong>
            </div>

            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>
                Base price
              </span>

              <strong>
                {Number(room.basePrice).toFixed(2)}
              </strong>
            </div>

            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>
                Status
              </span>

              <strong>
                {getRoomStatusLabel(room.status)}
              </strong>
            </div>

          </div>

        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Actions                                                            */}
        {/* ------------------------------------------------------------------ */}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.assignTask}
            onClick={openTaskModal}
          >
            Assign cleaning task
          </button>
          <button
            type="button"
            className={styles.backAction}
            onClick={() => router.back()}
          >
            Back to Room Setup
          </button>

        </div>

      </main>

      {isTaskModalOpen && (
        <div className={styles.modalOverlay} onClick={closeTaskModal}>
          <section
            className={styles.taskModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-task-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.cardLabel}>HOUSEKEEPING</p>
                <h2 id="assign-task-title">Assign cleaning task</h2>
                <p className={styles.modalSubtitle}>
                  Room {room.roomNumber} will be added to the selected
                  housekeeper&apos;s queue.
                </p>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={closeTaskModal}
                aria-label="Close assign task dialog"
              >
                ×
              </button>
            </div>

            <label className={styles.modalLabel} htmlFor="housekeeper">
              Assign to
            </label>
            <select
              id="housekeeper"
              className={styles.modalInput}
              value={selectedHousekeeperId}
              onChange={(event) => setSelectedHousekeeperId(event.target.value)}
              disabled={isLoadingHousekeepers || isSavingTask}
            >
              {isLoadingHousekeepers ? (
                <option value="">Loading housekeepers...</option>
              ) : housekeepers.length === 0 ? (
                <option value="">No active housekeepers found</option>
              ) : (
                housekeepers.map((housekeeper) => (
                  <option key={housekeeper.id} value={housekeeper.id}>
                    {housekeeper.fullName}
                  </option>
                ))
              )}
            </select>

            <label className={styles.modalLabel} htmlFor="task-comment">
              Comment
            </label>
            <textarea
              id="task-comment"
              className={styles.modalTextarea}
              placeholder="Add instructions for the housekeeper"
              maxLength={250}
              value={taskComment}
              onChange={(event) => setTaskComment(event.target.value)}
              disabled={isSavingTask}
            />
            <span className={styles.characterCount}>{taskComment.length}/250</span>

            {taskError && <p className={styles.modalError}>{taskError}</p>}
            {taskSuccess && <p className={styles.modalSuccess}>{taskSuccess}</p>}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={closeTaskModal}
                disabled={isSavingTask}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalSubmit}
                onClick={createTask}
                disabled={
                  isLoadingHousekeepers ||
                  isSavingTask ||
                  housekeepers.length === 0
                }
              >
                {isSavingTask ? "Assigning..." : "Assign task"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default ViewRoomPage;