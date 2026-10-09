"use client";

import React from "react";
import styles from "./HouseKeepingDash.module.css";
import { useAuth } from "../Auth/AuthProvider";

type TaskStatus = "PENDING" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

interface HousekeepingTask {
  id: string;
  status: TaskStatus;
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
}

const MAX_PHOTOS = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function getTaskStatusLabel(status: TaskStatus) {
  switch (status) {
    case "PENDING":
      return "Waiting";
    case "IN_PROGRESS":
      return "Cleaning";
    case "IN_REVIEW":
      return "Waiting review";
    case "DONE":
      return "Completed";
    default:
      return "Unknown";
  }
}

function formatTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getErrorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const record = data as { error?: unknown; message?: unknown };
    if (typeof record.error === "string") return record.error;
    if (typeof record.message === "string") return record.message;
  }
  return fallback;
}

export default function HouseKeepingDash() {
  const { user } = useAuth();
  const [tasks, setTasks] = React.useState<HousekeepingTask[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = React.useState<Record<string, File[]>>({});
  const [photoPreviews, setPhotoPreviews] = React.useState<Record<string, string[]>>({});
  const photoPreviewsRef = React.useRef<Record<string, string[]>>({});

  React.useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function fetchTasks() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/v1/housekeeping/tasks", {
          credentials: "include",
          signal: controller.signal,
        });
        const data: unknown = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(getErrorMessage(data, "Failed to load housekeeping tasks."));
        }
        if (controller.signal.aborted) return;

        setTasks(Array.isArray(data) ? (data as HousekeepingTask[]) : []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load housekeeping tasks.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void fetchTasks();
    return () => controller.abort();
  }, [user]);

  React.useEffect(() => {
    photoPreviewsRef.current = photoPreviews;
  }, [photoPreviews]);

  React.useEffect(() => {
    return () => {
      Object.values(photoPreviewsRef.current).flat().forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  async function startCleaning(task: HousekeepingTask) {
    try {
      setActionLoading(task.id);
      setError("");

      const response = await fetch(`/api/v1/housekeeping/tasks/${task.id}/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data: unknown = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Failed to start cleaning."));
      }

      const record = data && typeof data === "object" ? (data as { startedAt?: string | null }) : {};
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? { ...item, status: "IN_PROGRESS", startedAt: record.startedAt ?? new Date().toISOString() }
            : item,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start cleaning.");
    } finally {
      setActionLoading(null);
    }
  }

  function handlePhotoSelection(taskId: string, event: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (incoming.length === 0) return;

    const currentFiles = selectedPhotos[taskId] ?? [];
    const remainingSlots = Math.max(0, MAX_PHOTOS - currentFiles.length);
    const validFiles: File[] = [];
    let rejectedType = false;
    let rejectedSize = false;

    for (const file of incoming) {
      if (!file.type.startsWith("image/")) {
        rejectedType = true;
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        rejectedSize = true;
        continue;
      }
      validFiles.push(file);
    }

    const acceptedFiles = validFiles.slice(0, remainingSlots);
    const newPreviews = acceptedFiles.map((file) => URL.createObjectURL(file));

    if (rejectedType) setError("Only image files can be added.");
    else if (rejectedSize) setError("Each image must be 10 MB or smaller.");
    else if (validFiles.length > remainingSlots) setError(`You can add a maximum of ${MAX_PHOTOS} photos per task.`);
    else setError("");

    if (acceptedFiles.length === 0) return;

    setSelectedPhotos((current) => ({
      ...current,
      [taskId]: [...(current[taskId] ?? []), ...acceptedFiles],
    }));
    setPhotoPreviews((current) => ({
      ...current,
      [taskId]: [...(current[taskId] ?? []), ...newPreviews],
    }));
  }

  function removePhotos(taskId: string) {
    const oldPreviews = photoPreviews[taskId] ?? [];
    oldPreviews.forEach((url) => URL.revokeObjectURL(url));

    setSelectedPhotos((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
    setPhotoPreviews((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
  }

  async function completeCleaning(task: HousekeepingTask) {
    try {
      setActionLoading(task.id);
      setError("");

      const formData = new FormData();
      (selectedPhotos[task.id] ?? []).forEach((file) => formData.append("photos", file));

      const response = await fetch(`/api/v1/housekeeping/tasks/${task.id}/complete`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data: unknown = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Failed to complete cleaning."));
      }

      const record = data && typeof data === "object"
        ? (data as { status?: TaskStatus; completedAt?: string | null })
        : {};

      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: record.status ?? "IN_REVIEW",
                completedAt: record.completedAt ?? new Date().toISOString(),
              }
            : item,
        ),
      );
      removePhotos(task.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete cleaning.");
    } finally {
      setActionLoading(null);
    }
  }

  function handleTaskClick(task: HousekeepingTask) {
    if (actionLoading === task.id) return;
    if (task.status === "PENDING") void startCleaning(task);
    else if (task.status === "IN_PROGRESS") void completeCleaning(task);
  }

  const waitingTasks = tasks.filter((task) => task.status === "PENDING").length;
  const cleaningTasks = tasks.filter((task) => task.status === "IN_PROGRESS").length;
  const reviewTasks = tasks.filter((task) => task.status === "IN_REVIEW").length;
  const completedTasks = tasks.filter((task) => task.status === "DONE").length;
  const activeTasks = waitingTasks + cleaningTasks;
  const visibleTasks = tasks.filter((task) => task.status === "PENDING" || task.status === "IN_PROGRESS");

  const displayDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <main className={styles.main}>
          <div className={styles.loading}>
            <span className={styles.loadingSpinner} aria-hidden="true" />
            <p>Loading housekeeping tasks…</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <p className={styles.eyebrow}>HOTELFLOW · HOUSEKEEPING</p>
            <h1 className={styles.title}>Hello, {user?.fullName || "Housekeeping team"}!</h1>
            <p className={styles.date} suppressHydrationWarning>{displayDate}</p>
          </div>
          <div className={styles.user}>
            <span className={styles.userAvatar} aria-hidden="true">
              {(user?.fullName || "H").trim().charAt(0).toUpperCase()}
            </span>
            <div className={styles.userDetails}>
              <span className={styles.userName}>{user?.fullName || "Housekeeping"}</span>
              <span className={styles.roleBadge}>{user?.role || "HOUSEKEEPING"}</span>
            </div>
          </div>
        </header>

        {error && (
          <div className={styles.error} role="alert">
            <span className={styles.errorIcon} aria-hidden="true">!</span>
            <p>{error}</p>
            <button type="button" onClick={() => setError("")}>Dismiss</button>
          </div>
        )}

        <section className={styles.statsGrid} aria-label="Housekeeping task statistics">
          <article className={styles.statCard} data-tone="active">
            <span className={styles.statLabel}>ACTIVE TASKS</span>
            <strong className={styles.statValue}>{activeTasks}</strong>
            <span className={styles.statCaption}>Assigned to you now</span>
          </article>
          <article className={styles.statCard} data-tone="waiting">
            <span className={styles.statLabel}>WAITING</span>
            <strong className={styles.statValue}>{waitingTasks}</strong>
            <span className={styles.statCaption}>Ready to start</span>
          </article>
          <article className={styles.statCard} data-tone="cleaning">
            <span className={styles.statLabel}>CLEANING</span>
            <strong className={styles.statValue}>{cleaningTasks}</strong>
            <span className={styles.statCaption}>Currently in progress</span>
          </article>
          <article className={styles.statCard} data-tone="review">
            <span className={styles.statLabel}>WAITING REVIEW</span>
            <strong className={styles.statValue}>{reviewTasks}</strong>
            <span className={styles.statCaption}>Sent to the manager</span>
          </article>
          <article className={styles.statCard} data-tone="completed">
            <span className={styles.statLabel}>COMPLETED</span>
            <strong className={styles.statValue}>{completedTasks}</strong>
            <span className={styles.statCaption}>Approved and completed</span>
          </article>
        </section>

        <section className={styles.housekeepingSection}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>YOUR WORK QUEUE</p>
              <h2>My housekeeping tasks</h2>
              <p className={styles.sectionDescription}>
                Open a task to start cleaning. Add photos while working, then select the task again to submit it for review.
              </p>
            </div>
            <span className={styles.taskCounter}>
              <strong>{visibleTasks.length}</strong> {visibleTasks.length === 1 ? "active task" : "active tasks"}
            </span>
          </div>

          {visibleTasks.length === 0 ? (
            <div className={styles.emptyMessage}>
              <span className={styles.emptyIcon} aria-hidden="true">✓</span>
              <h3>All caught up</h3>
              <p>There are no housekeeping tasks waiting for cleaning right now.</p>
            </div>
          ) : (
            <div className={styles.housekeepingList}>
              {visibleTasks.map((task) => {
                const isLoading = actionLoading === task.id;
                const previews = photoPreviews[task.id] ?? [];
                const files = selectedPhotos[task.id] ?? [];
                const isPending = task.status === "PENDING";

                return (
                  <article
                    key={task.id}
                    className={`${styles.housekeepingCard} ${styles.clickable} ${isLoading ? styles.processing : ""}`}
                    onClick={() => handleTaskClick(task)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${isPending ? "Start cleaning" : "Complete cleaning"} for room ${task.room.roomNumber}`}
                    aria-busy={isLoading}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget || isLoading) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleTaskClick(task);
                      }
                    }}
                  >
                    <div className={styles.taskCardHeader}>
                      <div className={styles.taskStatus} data-status={task.status.toLowerCase()}>
                        <span className={styles.statusDot} aria-hidden="true" />
                        <span>{getTaskStatusLabel(task.status)}</span>
                      </div>
                      <span className={styles.roomTypeBadge}>{task.room.roomType}</span>
                    </div>

                    <div className={styles.roomInfo}>
                      <span className={styles.roomLabel}>ROOM</span>
                      <h3>{task.room.roomNumber}</h3>
                      {task.startedAt && (
                        <p className={styles.startedTime}>Started at {formatTime(task.startedAt)}</p>
                      )}
                    </div>

                    <div className={styles.taskDetails}>
                      <span className={styles.detailsLabel}>CLEANING NOTES</span>
                      <p>{task.notes?.trim() || "No special instructions provided."}</p>
                    </div>

                    {task.status === "IN_PROGRESS" && (
                      <div className={styles.photoArea} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.photoAreaHeader}>
                          <div>
                            <strong>Cleaning photos</strong>
                            <span>Upload up to {MAX_PHOTOS} images, 10 MB each.</span>
                          </div>
                          <span className={styles.photoCount}>{files.length}/{MAX_PHOTOS}</span>
                        </div>
                        <label className={styles.photoButton}>
                          <span aria-hidden="true">＋</span> Add pictures
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(event) => handlePhotoSelection(task.id, event)}
                            disabled={isLoading || files.length >= MAX_PHOTOS}
                          />
                        </label>
                        {previews.length > 0 && (
                          <div className={styles.photoPreviewArea}>
                            <div className={styles.photoPreviewRow}>
                              {previews.map((preview, index) => (
                                <img
                                  key={`${task.id}-${index}`}
                                  src={preview}
                                  alt={`Selected cleaning photo ${index + 1}`}
                                  className={styles.photoPreview}
                                />
                              ))}
                            </div>
                            <button
                              type="button"
                              className={styles.removePhotos}
                              onClick={() => removePhotos(task.id)}
                              disabled={isLoading}
                            >
                              Remove selected photos
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className={styles.taskAction}>
                      <span className={styles.actionText}>
                        {isLoading
                          ? (isPending ? "Starting cleaning…" : "Submitting for review…")
                          : (isPending ? "Start cleaning" : "Finish and submit for review")}
                      </span>
                      <span className={styles.actionArrow} aria-hidden="true">{isLoading ? "…" : "→"}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className={styles.footer}>
          <span>HotelFlow Housekeeping</span>
          <span>Keep every room guest-ready.</span>
        </footer>
      </main>
    </div>
  );
}
