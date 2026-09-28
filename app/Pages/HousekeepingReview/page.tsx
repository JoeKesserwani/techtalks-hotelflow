"use client";

import { useEffect, useState } from "react";
import styles from "./HousekeepingReview.module.css";
import { useAuth } from "@/components/Auth/AuthProvider";

type Status =
  | "active"
  | "awaiting"
  | "approved"
  | "pending"
  | "in-progress";

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
  status: "PENDING" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
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

let tasksRequest: Promise<ApiHousekeepingTask[]> | null = null;

function loadHousekeepingTasks() {
  if (!tasksRequest) {
    tasksRequest = fetch("/api/v1/housekeeping/tasks")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load housekeeping tasks.");
        }
        return data as ApiHousekeepingTask[];
      })
      .finally(() => {
        tasksRequest = null;
      });
  }

  return tasksRequest;
}

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
    status:
      task.status === "DONE"
        ? "approved"
        : task.status === "IN_REVIEW"
        ? "awaiting"
        : task.status === "IN_PROGRESS"
        ? "in-progress"
        : "pending",
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
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Status>("awaiting");
  const { user } = useAuth();
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
        const data = await loadHousekeepingTasks();
        setTasks(data.map(mapApiTask));
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

  const awaitingTasks = tasks.filter((task) => task.status === "awaiting");

  const approvedTasks = tasks.filter(
    (task) => task.status === "approved"
  );

  const activeTasks = tasks.filter(
    (task) => task.status === "pending" || task.status === "in-progress"
  );

  const visibleTasks =
    activeTab === "active"
      ? activeTasks
      : activeTab === "awaiting"
      ? awaitingTasks
      : approvedTasks;

  function openReview(
    task: HousekeepingTask,
    action: "approved" | "rejected"
  ) {
    setReviewError(null);
    setReviewTask(task);
    setReviewAction(action);
    setComment("");
  }

  async function submitReview(taskId: string, action: "approve" | "reject", reviewComment?: string) {
    const request = () =>
      fetch(`/api/v1/housekeeping/tasks/${taskId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: reviewComment }),
      });

    let response = await request();

    if (response.status === 401) {
      const refreshResponse = await fetch("/api/v1/auth/refresh", {
        method: "POST",
      });

      if (refreshResponse.ok) response = await request();
    }

    return response;
  }

  async function confirmReview() {
    if (!reviewTask || !reviewAction) return;

    if (reviewAction === "rejected" && comment.trim() === "") {
      setReviewError("A comment is required before rejecting a room.");
      return;
    }

    const response = await submitReview(
      reviewTask.id,
      reviewAction === "approved" ? "approve" : "reject",
      comment.trim() || undefined
    );

    if (response.status === 409) {
      const refreshResponse = await fetch("/api/v1/housekeeping/tasks");
      if (refreshResponse.ok) {
        const refreshedTasks = await refreshResponse.json();
        setTasks((refreshedTasks as ApiHousekeepingTask[]).map(mapApiTask));
      }

      setReviewTask(null);
      setReviewAction(null);
      setReviewError("This task changed status. The task list was refreshed.");
      return;
    }

    const data = await response.json();
    if (!response.ok) {
      setReviewError(data.error ?? "Unable to review housekeeping task.");
      return;
    }

    setTasks((current) =>
      current.map((task) =>
        task.id === reviewTask.id
          ? {
              ...task,
              status: reviewAction === "approved" ? "approved" : "pending",
              comment: comment.trim() || task.comment,
              reviewedAt: "Just now",
            }
          : task
      )
    );

    setReviewTask(null);
    setReviewAction(null);
    setComment("");

    setActiveTab(reviewAction === "approved" ? "approved" : "active");
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
      <div className={styles.container}>

        {/* Header */}
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>
              Housekeeping review
            </h1>

            <p className={styles.subtitle}>
                {awaitingTasks.length} awaiting -{" "}
              {approvedTasks.length} done-{activeTasks.length} active
            </p>
          </div>

          <div className={styles.role}>
            <div className={styles.roleInfo}>
              <strong>{user?.fullName}</strong>
              <span>Currently reviewing rooms</span>
            </div>

            <div className={styles.roleBadge}>
              {user?.role }
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
            Done ({approvedTasks.length})
          </button>

          <button
            className={`${styles.tab} ${
              activeTab === "active" ? styles.activeTab : ""
            }`}
            onClick={() => setActiveTab("active")}
          >
            Active ({activeTasks.length})
          </button>
        </div>

        {/* Description */}
        <div className={styles.tabHeader}>
          <p>
            {activeTab === "active" &&
              "Tasks that are pending or currently in progress."}

            {activeTab === "awaiting" &&
              "Recently cleaned rooms waiting for approval."}

            {activeTab === "approved" &&
              "Housekeeping tasks marked as done."}
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
          reviewError={reviewError}
          setReviewError={setReviewError}
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
          <h1   />
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
          : status === "pending"
          ? styles.pending
          : status === "in-progress"
          ? styles.inProgress
          : styles.awaiting
      }`}
    >
      {status === "approved"
        ? "Done"
        : status === "pending"
        ? "Pending"
        : status === "in-progress"
        ? "In progress"
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
  reviewError,
  setReviewError,
  setComment,
  onCancel,
  onConfirm,
}: {
  task: HousekeepingTask;
  action: "approved" | "rejected";
  comment: string;
  reviewError: string | null;
  setReviewError: (value: string | null) => void;
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
          <span> {approving ? "(optional)" : "(required)"} </span>
        </label>

        <textarea
          value={comment}
          onChange={(e) => {
            if (reviewError) setReviewError(null);
            setComment(e.target.value);
          }}
          required={!approving}
          placeholder={
            approving
              ? "Leave a note for the housekeeper..."
              : "Explain what needs to be corrected..."
          }
          className={styles.textarea}
          maxLength={250}
        />

        {reviewError && <p className={styles.reviewError}>{reviewError}</p>}

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