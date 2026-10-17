"use client";

import React, { useEffect, useState } from "react";
import AssignTaskModal from "@/components/Housekeeping/AssignTaskModal";
import { useParams, useRouter } from "next/navigation";
import styles from "./viewRoom.module.css";
import Header from "@/components/Header/Header";
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
  const { currencySymbol } = useAuth();

  const roomId = params.id as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  function openTaskModal() {
    setIsTaskModalOpen(true);
  }

  function closeTaskModal() {
    setIsTaskModalOpen(false);
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
            </div>
          </header>
          <Header
            title="Room Details"
            subtitle="Unable to load the requested room."
            userSubtitle="Currently managing rooms"
          />
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
          </div>

        </header>
        <p className={styles.label}>
            ROOM DETAILS
        </p>
        <Header
          title={`Room ${room.roomNumber}`}
          subtitle={`${room.roomType} room on floor ${room.floor}`}
          userSubtitle="Currently managing rooms"
        />
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
                {currencySymbol}{Number(room.basePrice).toFixed(2)}
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

      {room && (
        <AssignTaskModal
          isOpen={isTaskModalOpen}
          roomId={room.id}
          roomNumber={room.roomNumber}
          onClose={closeTaskModal}
        />
      )}
    </div>
  );
};

export default ViewRoomPage;