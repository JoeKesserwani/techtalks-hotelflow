"use client";

import { useEffect, useState } from "react";
import styles from "./HousekeepingReview.module.css";
import Sidebar from "@/components/Navbars/navbar";

type Status = "awaiting" | "approved" | "rejected";

type HousekeepingTask = {
  id: string;
  roomNumber: string;
  roomType: string;
  cleanerName: string;
  cleanedAt: string;
  status: Status;
  pictures: string[];
  comment?: string;
  reviewedAt?: string;
};

type ApiHousekeepingTask = {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "DONE";
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  photos: unknown;
  createdAt: string;
  room: {
    roomNumber: string;
    roomType: string;
  };
  assignedTo: {
    fullName: string;
  };
};

function mapApiTask(task: ApiHousekeepingTask): HousekeepingTask {
  const pictures = Array.isArray(task.photos)
    ? task.photos.filter(
        (photo): photo is string => typeof photo === "string"
      )
    : [];

  return {
    id: task.id,
    roomNumber: task.room.roomNumber,
    roomType: task.room.roomType,
    cleanerName: task.assignedTo.fullName,
    cleanedAt: formatTaskDate(task.completedAt ?? task.createdAt),
    status: "awaiting",
    pictures,
    comment: task.notes ?? undefined,
  };
}

function formatTaskDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function HousekeepingReviewPage() {
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Status>("awaiting");

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const [reviewTask, setReviewTask] =
    useState<HousekeepingTask | null>(null);

  const [reviewAction, setReviewAction] =
    useState<"approved" | "rejected" | null>(null);

  const [comment, setComment] = useState("");

  useEffect(() => {
    async function loadTasks() {
      try {
        const response = await fetch("/api/v1/housekeeping/tasks");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load housekeeping tasks.");
        }

        setTasks((data as ApiHousekeepingTask[]).map(mapApiTask));
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load housekeeping tasks."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadTasks();
  }, []);

  const awaitingTasks = tasks.filter(
    (task) => task.status === "awaiting"
  );

  const approvedTasks = tasks.filter(
    (task) => task.status === "approved"
  );

  const rejectedTasks = tasks.filter(
    (task) => task.status === "rejected"
  );

  const visibleTasks =
    activeTab === "awaiting"
      ? awaitingTasks
      : activeTab === "approved"
      ? approvedTasks
      : rejectedTasks;

  function openReview(
    task: HousekeepingTask,
    action: "approved" | "rejected"
  ) {
    setReviewTask(task);
    setReviewAction(action);
    setComment("");
  }

  function confirmReview() {
    if (!reviewTask || !reviewAction) return;

    setTasks((current) =>
      current.map((task) =>
        task.id === reviewTask.id
          ? {
              ...task,
              status: reviewAction,
              comment: comment.trim() || undefined,
              reviewedAt: "Just now",
            }
          : task
      )
    );

    setReviewTask(null);
    setReviewAction(null);
    setComment("");

    setActiveTab(reviewAction);
  }

  function openImage(image: string) {
    setSelectedImage(image);
    setZoom(1);
  }

  function closeImage() {
    setSelectedImage(null);
    setZoom(1);
  }

  return (
    <main className={styles.page}>
      <Sidebar />
      <div className={styles.container}>

        {/* Header */}
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>
              Housekeeping review
            </h1>

            <p className={styles.subtitle}>
              {awaitingTasks.length} awaiting -{" "}
              {approvedTasks.length} approved today -{" "}
              {rejectedTasks.length} rejected
            </p>
          </div>

          <div className={styles.receptionist}>
            <div className={styles.receptionistInfo}>
              <strong>Receptionist name</strong>
              <span>Currently reviewing rooms</span>
            </div>

            <div className={styles.receptionistBadge}>
              Receptionist
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className={styles.tabs}>

          <button
            className={`${styles.tab} ${
              activeTab === "awaiting"
                ? styles.activeTab
                : ""
            }`}
            onClick={() => setActiveTab("awaiting")}
          >
            Awaiting approval ({awaitingTasks.length})
          </button>

          <button
            className={`${styles.tab} ${
              activeTab === "approved"
                ? styles.activeTab
                : ""
            }`}
            onClick={() => setActiveTab("approved")}
          >
            Approved today ({approvedTasks.length})
          </button>

          <button
            className={`${styles.tab} ${
              activeTab === "rejected"
                ? styles.activeTab
                : ""
            }`}
            onClick={() => setActiveTab("rejected")}
          >
            Rejected ({rejectedTasks.length})
          </button>

        </div>

        {/* Description */}
        <div className={styles.tabHeader}>
          <p>
            {activeTab === "awaiting" &&
              "Recently cleaned rooms waiting for approval."}

            {activeTab === "approved" &&
              "Housekeeping tasks approved today."}

            {activeTab === "rejected" &&
              "Housekeeping tasks that were rejected."}
          </p>
        </div>

        {/* Tasks */}
        <section className={styles.taskList}>
          {isLoading ? (
            <div className={styles.emptyState}>
              <h2>Loading tasks</h2>
              <p>Fetching the latest housekeeping tasks.</p>
            </div>
          ) : loadError ? (
            <div className={styles.emptyState}>
              <h2>Unable to load tasks</h2>
              <p>{loadError}</p>
            </div>
          ) : visibleTasks.length === 0 ? (
            <div className={styles.emptyState}>
              <h2>No tasks found</h2>
              <p>
                There are currently no housekeeping tasks
                in this category.
              </p>
            </div>
          ) : (
            visibleTasks.map((task) => (
              <HousekeepingCard
                key={task.id}
                task={task}
                onImageClick={openImage}
                onApprove={() =>
                  openReview(task, "approved")
                }
                onReject={() =>
                  openReview(task, "rejected")
                }
              />
            ))
          )}
        </section>
      </div>

      {/* Image popup */}
      {selectedImage && (
        <ImageModal
          image={selectedImage}
          zoom={zoom}
          setZoom={setZoom}
          onClose={closeImage}
        />
      )}

      {/* Review popup */}
      {reviewTask && reviewAction && (
        <ReviewModal
          task={reviewTask}
          action={reviewAction}
          comment={comment}
          setComment={setComment}
          onCancel={() => {
            setReviewTask(null);
            setReviewAction(null);
          }}
          onConfirm={confirmReview}
        />
      )}
    </main>
  );
}


/* -------------------------------------------------------------------------- */
/* Housekeeping Card                                                          */
/* -------------------------------------------------------------------------- */

function HousekeepingCard({
  task,
  onImageClick,
  onApprove,
  onReject,
}: {
  task: HousekeepingTask;
  onImageClick: (image: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <article className={styles.taskCard}>

      {/* Pictures */}
      <div className={styles.pictures}>
        {task.pictures.map((picture, index) => (
          <button
            key={picture}
            className={styles.pictureButton}
            onClick={() => onImageClick(picture)}
          >
            <img
              src={picture}
              alt={`Room ${task.roomNumber} photo ${index + 1}`}
            />

            {index === 0 && task.pictures.length > 1 && (
              <span className={styles.pictureCount}>
                +{task.pictures.length - 1}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Room information */}
      <div className={styles.taskInfo}>
        <div className={styles.roomTitle}>
          <h2>Room {task.roomNumber}</h2>

          <StatusBadge status={task.status} />
        </div>

        <p>
          {task.cleanerName} · {task.cleanedAt} ·{" "}
          {task.roomType}
        </p>

        {task.reviewedAt && (
          <small>
            Reviewed {task.reviewedAt}
          </small>
        )}

        {task.comment && (
          <div className={styles.comment}>
            <strong>Comment</strong>
            <p>{task.comment}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {task.status === "awaiting" ? (
          <>
            <button
              className={styles.rejectButton}
              onClick={onReject}
            >
              Reject
            </button>

            <button
              className={styles.approveButton}
              onClick={onApprove}
            >
              Approve
            </button>
          </>
        ) : (
          <StatusBadge status={task.status} />
        )}
      </div>
    </article>
  );
}


/* -------------------------------------------------------------------------- */
/* Status Badge                                                               */
/* -------------------------------------------------------------------------- */

function StatusBadge({
  status,
}: {
  status: Status;
}) {
  return (
    <span
      className={`${styles.statusBadge} ${
        status === "approved"
          ? styles.approved
          : status === "rejected"
          ? styles.rejected
          : styles.awaiting
      }`}
    >
      {status === "approved"
        ? "Approved"
        : status === "rejected"
        ? "Rejected"
        : "Awaiting approval"}
    </span>
  );
}


/* -------------------------------------------------------------------------- */
/* Review Modal                                                               */
/* -------------------------------------------------------------------------- */

function ReviewModal({
  task,
  action,
  comment,
  setComment,
  onCancel,
  onConfirm,
}: {
  task: HousekeepingTask;
  action: "approved" | "rejected";
  comment: string;
  setComment: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const approving = action === "approved";

  return (
    <div
      className={styles.modalOverlay}
      onMouseDown={onCancel}
    >
      <div
        className={styles.reviewModal}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className={styles.modalLabel}>
          HOUSEKEEPING REVIEW
        </p>

        <h2>
          {approving ? "Approve" : "Reject"} Room{" "}
          {task.roomNumber}
        </h2>

        <p className={styles.modalDescription}>
          {approving
            ? "The room will be marked as approved."
            : "The room will be marked as rejected and sent back to housekeeping."}
        </p>

        <label className={styles.textareaLabel}>
          Comment
          <span> (optional)</span>
        </label>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={
            approving
              ? "Leave a note for the housekeeper..."
              : "Explain what needs to be corrected..."
          }
          className={styles.textarea}
        />

        <div className={styles.modalActions}>
          <button
            className={styles.cancelButton}
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            className={
              approving
                ? styles.modalApprove
                : styles.modalReject
            }
            onClick={onConfirm}
          >
            {approving
              ? "Approve room"
              : "Reject room"}
          </button>
        </div>
      </div>
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/* Image Modal                                                                */
/* -------------------------------------------------------------------------- */

function ImageModal({
  image,
  zoom,
  setZoom,
  onClose,
}: {
  image: string;
  zoom: number;
  setZoom: (value: number) => void;
  onClose: () => void;
}) {
  return (
    <div
      className={styles.imageOverlay}
      onMouseDown={onClose}
    >
      <button
        className={styles.closeImage}
        onClick={onClose}
      >
        ×
      </button>

      <div
        className={styles.zoomControls}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={() =>
            setZoom(Math.max(0.5, zoom - 0.25))
          }
        >
          −
        </button>

        <span>{Math.round(zoom * 100)}%</span>

        <button
          onClick={() =>
            setZoom(Math.min(3, zoom + 0.25))
          }
        >
          +
        </button>
      </div>

      <div
        className={styles.imageContainer}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <img
          src={image}
          alt="Housekeeping room"
          style={{
            transform: `scale(${zoom})`,
          }}
        />
      </div>
    </div>
  );
}