
"use client";

import React from "react";
import styles from "./HouseKeepingDash.module.css";
import { useAuth } from "../Auth/AuthProvider";

type TaskStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "DONE";

interface HousekeepingTask {
  id: string;
  status: TaskStatus;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  photos: string[] | null;
  createdAt: string;

  room: {
    roomNumber: string;
    roomType: string;
  };

  assignedTo: {
    fullName: string;
  };
}

const getTaskStatusLabel = (status: TaskStatus) => {
  switch (status) {
    case "PENDING":
      return "Waiting";

    case "IN_PROGRESS":
      return "Cleaning";

    case "IN_REVIEW":
      return "In review";

    case "DONE":
      return "Completed";

    default:
      return "Unknown";
  }
};

const HouseKeepingDash = () => {
  const { user } = useAuth();

  const [tasks, setTasks] = React.useState<HousekeepingTask[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [actionLoading, setActionLoading] =
    React.useState<string | null>(null);

  /*
   * Files selected from the computer/phone.
   * These are temporary until the task is completed.
   */
  const [selectedPhotos, setSelectedPhotos] = React.useState<
    Record<string, File[]>
  >({});

  /*
   * Temporary browser previews.
   */
  const [photoPreviews, setPhotoPreviews] = React.useState<
    Record<string, string[]>
  >({});

  /*
   * Selected task for viewing saved photos.
   */
  const [selectedTask, setSelectedTask] =
    React.useState<HousekeepingTask | null>(null);

  const [showPhotoModal, setShowPhotoModal] =
    React.useState(false);

  /*
   * ================================
   * LOAD TASKS
   * ================================
   */

  React.useEffect(() => {
    if (!user) return;

    const controller = new AbortController();

    const fetchTasks = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          "/api/v1/housekeeping/tasks",
          {
            credentials: "include",
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              data?.message ||
              "Failed to load housekeeping tasks"
          );
        }

        if (controller.signal.aborted) return;

        setTasks(Array.isArray(data) ? data : []);
      } catch (err) {
        if (controller.signal.aborted) return;

        console.error(
          "Failed to load housekeeping tasks:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load housekeeping tasks"
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchTasks();

    return () => controller.abort();
  }, [user]);

  /*
   * ================================
   * START CLEANING
   * ================================
   */

  const startCleaning = async (
    task: HousekeepingTask
  ) => {
    try {
      setActionLoading(task.id);
      setError("");

      const response = await fetch(
        `/api/v1/housekeeping/tasks/${task.id}/start`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Failed to start cleaning"
        );
      }

      setTasks((previousTasks) =>
        previousTasks.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: "IN_PROGRESS",
                startedAt:
                  data.startedAt ??
                  new Date().toISOString(),
              }
            : item
        )
      );
    } catch (err) {
      console.error(
        "Failed to start cleaning:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to start cleaning"
      );
    } finally {
      setActionLoading(null);
    }
  };

  /*
   * ================================
   * UPLOAD PHOTO
   * ================================
   *
   * Sends one File to:
   *
   * POST /api/v1/housekeeping/upload
   *
   * The API returns:
   *
   * {
   *   url: "/uploads/housekeeping/....jpg"
   * }
   */

  const uploadPhoto = async (
    file: File
  ): Promise<string> => {
    const formData = new FormData();

    formData.append("file", file);

    const response = await fetch(
      "/api/v1/housekeeping/upload",
      {
        method: "POST",
        credentials: "include",
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          data?.message ||
          "Failed to upload image"
      );
    }

    if (!data?.url) {
      throw new Error(
        "Upload succeeded but no image URL was returned"
      );
    }

    return data.url;
  };

  /*
   * ================================
   * PHOTO SELECTION
   * ================================
   */

  const handlePhotoSelection = (
    taskId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(
      event.target.files || []
    );

    if (files.length === 0) return;

    const validFiles = files
      .filter((file) =>
        file.type.startsWith("image/")
      )
      .slice(0, 10);

    if (validFiles.length === 0) {
      setError("Please select image files only.");
      event.target.value = "";
      return;
    }

    /*
     * Remove old preview URLs for this task
     * before creating new ones.
     */
    const oldPreviews =
      photoPreviews[taskId] || [];

    oldPreviews.forEach((preview) => {
      URL.revokeObjectURL(preview);
    });

    const previews = validFiles.map((file) =>
      URL.createObjectURL(file)
    );

    setSelectedPhotos((previous) => ({
      ...previous,
      [taskId]: validFiles,
    }));

    setPhotoPreviews((previous) => ({
      ...previous,
      [taskId]: previews,
    }));

    setError("");

    /*
     * Allows selecting the same file again.
     */
    event.target.value = "";
  };

  /*
   * ================================
   * REMOVE SELECTED PHOTOS
   * ================================
   */

  const removePhotos = (taskId: string) => {
    const previews =
      photoPreviews[taskId] || [];

    previews.forEach((preview) => {
      URL.revokeObjectURL(preview);
    });

    setSelectedPhotos((previous) => {
      const next = { ...previous };
      delete next[taskId];
      return next;
    });

    setPhotoPreviews((previous) => {
      const next = { ...previous };
      delete next[taskId];
      return next;
    });
  };

  /*
   * ================================
   * COMPLETE CLEANING
   * ================================
   *
   * 1. Upload selected images.
   * 2. Collect their URLs.
   * 3. Send URLs to the complete API.
   * 4. API stores URLs in HousekeepingTask.photos.
   */

  const completeCleaning = async (
    task: HousekeepingTask
  ) => {
    try {
      setActionLoading(task.id);
      setError("");

      const files =
        selectedPhotos[task.id] || [];

      const photoUrls: string[] = [];

      /*
       * Upload every selected image.
       */
      for (const file of files) {
        const url = await uploadPhoto(file);

        photoUrls.push(url);
      }

      /*
       * Complete the housekeeping task.
       */
      const response = await fetch(
        `/api/v1/housekeeping/tasks/${task.id}/complete`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            photos: photoUrls,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Failed to complete cleaning"
        );
      }

      /*
       * Remove temporary browser previews.
       */
      removePhotos(task.id);

      /*
       * Update the task locally.
       */
      setTasks((previousTasks) =>
        previousTasks.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: "IN_REVIEW",
                completedAt:
                  data.completedAt ??
                  new Date().toISOString(),
                photos:
                  Array.isArray(data.photos)
                    ? data.photos
                    : photoUrls,
              }
            : item
        )
      );
    } catch (err) {
      console.error(
        "Failed to complete cleaning:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to complete cleaning"
      );
    } finally {
      setActionLoading(null);
    }
  };

  /*
   * ================================
   * CLICK TASK
   * ================================
   *
   * PENDING:
   * click -> start
   *
   * IN_PROGRESS:
   * click -> complete
   *
   * IN_REVIEW / DONE:
   * no workflow action
   */

  const handleTaskClick = (
    task: HousekeepingTask
  ) => {
    if (actionLoading === task.id) return;

    if (task.status === "PENDING") {
      startCleaning(task);
      return;
    }

    if (task.status === "IN_PROGRESS") {
      completeCleaning(task);
    }
  };

  /*
   * ================================
   * PHOTO MODAL
   * ================================
   */

  const openPhotoModal = (
    task: HousekeepingTask
  ) => {
    setSelectedTask(task);
    setShowPhotoModal(true);
  };

  const closePhotoModal = () => {
    setSelectedTask(null);
    setShowPhotoModal(false);
  };

  /*
   * ================================
   * STATISTICS
   * ================================
   */

  const totalTasks = tasks.length;

  const waitingTasks = tasks.filter(
    (task) => task.status === "PENDING"
  ).length;

  const cleaningTasks = tasks.filter(
    (task) => task.status === "IN_PROGRESS"
  ).length;

  const reviewTasks = tasks.filter(
    (task) => task.status === "IN_REVIEW"
  ).length;

  const completedTasks = tasks.filter(
    (task) => task.status === "DONE"
  ).length;

  /*
   * ================================
   * LOADING
   * ================================
   */

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <main className={styles.main}>
          <div className={styles.loading}>
            Loading housekeeping tasks...
          </div>
        </main>
      </div>
    );
  }

  /*
   * ================================
   * DASHBOARD
   * ================================
   */

  return (
    <div className={styles.dashboard}>
      <main className={styles.main}>

        {/* HEADER */}

        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>
              Hello, {user?.fullName}!
            </h1>

            <p
              className={styles.date}
              suppressHydrationWarning
            >
              {new Date().toLocaleDateString(
                "en-US",
                {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }
              )}
            </p>
          </div>

          <div className={styles.user}>
            <span
              className={styles.roleBadge}
            >
              {user?.role}
            </span>
          </div>
        </header>

        {/* ERROR */}

        {error && (
          <div className={styles.error}>
            <span>{error}</span>

            <button
              onClick={() =>
                window.location.reload()
              }
            >
              Try again
            </button>
          </div>
        )}

        {/* STATISTICS */}

        <section className={styles.statsGrid}>

          <article className={styles.statCard}>
            <strong
              className={styles.statValue}
            >
              {totalTasks}
            </strong>

            <p className={styles.statLabel}>
              TOTAL TASKS
            </p>
          </article>

          <article className={styles.statCard}>
            <strong
              className={styles.statValue}
            >
              {waitingTasks}
            </strong>

            <p className={styles.statLabel}>
              WAITING
            </p>
          </article>

          <article className={styles.statCard}>
            <strong
              className={styles.statValue}
            >
              {cleaningTasks}
            </strong>

            <p className={styles.statLabel}>
              CLEANING
            </p>
          </article>

          <article className={styles.statCard}>
            <strong
              className={`${styles.statValue} ${styles.awaitingValue}`}
            >
              {reviewTasks}
            </strong>

            <p className={styles.statLabel}>
              AWAITING REVIEW
            </p>
          </article>

        </section>

        {/* HOUSEKEEPING TASKS */}

        <section
          className={
            styles.housekeepingSection
          }
        >

          <div
            className={styles.sectionHeader}
          >
            <div>
              <h2>
                My housekeeping tasks
              </h2>

              <p>
                Click a task to start
                cleaning. Click it again
                when cleaning is finished.
              </p>
            </div>

            <span
              className={styles.taskCounter}
            >
              {totalTasks} Tasks
            </span>
          </div>

          <div
            className={
              styles.housekeepingList
            }
          >

            {tasks.length === 0 ? (
              <div
                className={
                  styles.emptyMessage
                }
              >
                No housekeeping tasks
                assigned to you.
              </div>
            ) : (
              tasks.map((task) => {
                const isLoading =
                  actionLoading === task.id;

                const previews =
                  photoPreviews[task.id] || [];

                const savedPhotos =
                  Array.isArray(task.photos)
                    ? task.photos
                    : [];

                const canClick =
                  task.status === "PENDING" ||
                  task.status === "IN_PROGRESS";

                const hasSavedPhotos =
                  savedPhotos.length > 0;

                return (
                  <article
                    key={task.id}
                    className={`
                      ${styles.housekeepingCard}
                      ${
                        canClick
                          ? styles.clickable
                          : ""
                      }
                      ${
                        isLoading
                          ? styles.processing
                          : ""
                      }
                    `}
                    onClick={() =>
                      handleTaskClick(task)
                    }
                    role={
                      canClick
                        ? "button"
                        : undefined
                    }
                    tabIndex={
                      canClick ? 0 : undefined
                    }
                    onKeyDown={(event) => {
                      if (
                        !canClick ||
                        isLoading
                      ) {
                        return;
                      }

                      if (
                        event.key === "Enter" ||
                        event.key === " "
                      ) {
                        event.preventDefault();
                        handleTaskClick(task);
                      }
                    }}
                  >

                    {/* STATUS */}

                    <div
                      className={
                        styles.taskStatus
                      }
                    >
                      <span
                        className={`
                          ${styles.statusDot}
                          ${
                            styles[
                              `status-${task.status.toLowerCase()}`
                            ]
                          }
                        `}
                      />

                      <span>
                        {getTaskStatusLabel(
                          task.status
                        )}
                      </span>
                    </div>

                    {/* ROOM */}

                    <div
                      className={
                        styles.roomInfo
                      }
                    >
                      <span
                        className={
                          styles.roomLabel
                        }
                      >
                        ROOM
                      </span>

                      <h3>
                        {task.room.roomNumber}
                      </h3>

                      <p>
                        {task.room.roomType}
                      </p>
                    </div>

                    {/* DETAILS */}

                    <div
                      className={
                        styles.taskDetails
                      }
                    >
                      {task.notes && (
                        <p>
                          <strong>
                            Notes:
                          </strong>{" "}
                          {task.notes}
                        </p>
                      )}

                      {task.startedAt && (
                        <p>
                          <strong>
                            Started:
                          </strong>{" "}
                          {new Date(
                            task.startedAt
                          ).toLocaleTimeString(
                            [],
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </p>
                      )}

                      {task.completedAt && (
                        <p>
                          <strong>
                            Completed:
                          </strong>{" "}
                          {new Date(
                            task.completedAt
                          ).toLocaleTimeString(
                            [],
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </p>
                      )}
                    </div>

                    {/* PHOTO AREA */}

                    {task.status ===
                      "IN_PROGRESS" && (
                      <div
                        className={
                          styles.photoArea
                        }
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                      >
                        <label
                          className={
                            styles.photoButton
                          }
                        >
                          📷 Add pictures

                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(event) =>
                              handlePhotoSelection(
                                task.id,
                                event
                              )
                            }
                            disabled={isLoading}
                          />
                        </label>

                        {previews.length > 0 && (
                          <div
                            className={
                              styles.photoPreviewRow
                            }
                          >
                            {previews.map(
                              (
                                preview,
                                index
                              ) => (
                                <img
                                  key={`${task.id}-${index}`}
                                  src={preview}
                                  alt={`Cleaning photo ${
                                    index + 1
                                  }`}
                                  className={
                                    styles.photoPreview
                                  }
                                />
                              )
                            )}

                            <button
                              type="button"
                              className={
                                styles.removePhotos
                              }
                              onClick={() =>
                                removePhotos(
                                  task.id
                                )
                              }
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SAVED PHOTOS */}

                    {hasSavedPhotos && (
                      <div
                        className={
                          styles.photoArea
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          openPhotoModal(task);
                        }}
                      >
                        <button
                          type="button"
                          className={
                            styles.photoButton
                          }
                        >
                          📷 View{" "}
                          {savedPhotos.length}{" "}
                          {savedPhotos.length === 1
                            ? "photo"
                            : "photos"}
                        </button>

                        <div
                          className={
                            styles.photoPreviewRow
                          }
                        >
                          {savedPhotos
                            .slice(0, 3)
                            .map(
                              (
                                photo,
                                index
                              ) => (
                                <img
                                  key={`${task.id}-saved-${index}`}
                                  src={photo}
                                  alt={`Saved cleaning photo ${
                                    index + 1
                                  }`}
                                  className={
                                    styles.photoPreview
                                  }
                                />
                              )
                            )}
                        </div>
                      </div>
                    )}

                    {/* ACTION */}

                    <div
                      className={
                        styles.taskAction
                      }
                    >
                      {task.status ===
                        "PENDING" && (
                        <span
                          className={
                            styles.startText
                          }
                        >
                          {isLoading
                            ? "Starting..."
                            : "Click to start cleaning →"}
                        </span>
                      )}

                      {task.status ===
                        "IN_PROGRESS" && (
                        <span
                          className={
                            styles.completeText
                          }
                        >
                          {isLoading
                            ? "Completing..."
                            : "Click again when finished →"}
                        </span>
                      )}

                      {task.status ===
                        "IN_REVIEW" && (
                        <span
                          className={
                            styles.reviewText
                          }
                        >
                          Waiting for manager
                          review
                        </span>
                      )}

                      {task.status ===
                        "DONE" && (
                        <span
                          className={
                            styles.doneText
                          }
                        >
                          ✓ Task completed
                        </span>
                      )}
                    </div>

                  </article>
                );
              })
            )}

          </div>
        </section>

        {/* COMPLETED SUMMARY */}

        <section
          className={
            styles.completedSection
          }
        >
          <div
            className={
              styles.completedSummary
            }
          >
            <div>
              <span>
                Completed tasks
              </span>

              <strong>
                {completedTasks}
              </strong>
            </div>

            <div>
              <span>
                Tasks awaiting review
              </span>

              <strong>
                {reviewTasks}
              </strong>
            </div>
          </div>
        </section>

      </main>

      {/* PHOTO MODAL */}

      {showPhotoModal &&
        selectedTask && (
          <div
            className={
              styles.modalOverlay
            }
            onClick={closePhotoModal}
          >
            <div
              className={styles.modal}
              onClick={(event) =>
                event.stopPropagation()
              }
            >

              <button
                className={
                  styles.modalClose
                }
                onClick={closePhotoModal}
              >
                ×
              </button>

              <h2>
                Cleaning Photos
              </h2>

              <p>
                Room{" "}
                {selectedTask.room.roomNumber}
              </p>

              {Array.isArray(
                selectedTask.photos
              ) &&
              selectedTask.photos.length >
                0 ? (
                <div
                  className={
                    styles.modalPhotoGrid
                  }
                >
                  {selectedTask.photos.map(
                    (photo, index) => (
                      <img
                        key={`${selectedTask.id}-modal-${index}`}
                        src={photo}
                        alt={`Cleaning photo ${
                          index + 1
                        }`}
                      />
                    )
                  )}
                </div>
              ) : (
                <div
                  className={
                    styles.noPhotos
                  }
                >
                  No photos uploaded for
                  this task.
                </div>
              )}

              <button
                className={
                  styles.closeButton
                }
                onClick={closePhotoModal}
              >
                Close
              </button>

            </div>
          </div>
        )}
    </div>
  );
};
export default HouseKeepingDash;
