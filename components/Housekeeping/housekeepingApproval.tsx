"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import rawStyles from "./housekeepingApproval.module.css";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

export interface HousekeepingTask {
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
  photos?: unknown;
  photoFiles?: {
    id: string;
  }[];
}

export type ReviewAction = "approve" | "reject";

export interface HousekeepingReviewProps {
  /** Tasks currently awaiting approval (owned by the parent page). */
  tasks: HousekeepingTask[];

  /**
   * Called after the backend successfully approved/rejected a task.
   * The parent should update its own state / refetch data here.
   * The success modal is shown after this promise resolves.
   */
  onTaskReviewed?: (
    task: HousekeepingTask,
    action: ReviewAction,
  ) => void | Promise<void>;

  /** Section title. */
  title?: string;

  /** Show the "View all" link. Defaults to true. */
  showViewAll?: boolean;

  /** Route opened by "View all". */
  viewAllHref?: string;

  /** Text shown when there are no tasks. */
  emptyMessage?: string;

  /** Limit the number of rows rendered (renders all when omitted). */
  maxItems?: number;
}

type ModalType = "photo" | "reject" | "approve" | "success" | null;
type ResultType = "approved" | "rejected" | null;

const REVIEW_ENDPOINT = (taskId: string) =>
  `/api/v1/housekeeping/tasks/${taskId}/review`;

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap";

// CSS-module interop: some bundlers return { default: classMap },
// and some return no class map at all. Global hk-* classes still match.
const styleMap: Record<string, string> = (() => {
  const mod = rawStyles as
    | (Record<string, string> & { default?: Record<string, string> })
    | undefined;
  if (!mod || typeof mod !== "object") return {};
  if (typeof mod.housekeepingSection === "string") return mod;
  if (mod.default && typeof mod.default.housekeepingSection === "string") {
    return mod.default;
  }
  return {};
})();

function hk(localKey: string, globalName: string) {
  const local = styleMap[localKey];
  return local ? `${local} ${globalName}` : globalName;
}

function getTaskPhotoUrls(task: HousekeepingTask) {
  const photoFileUrls = (task.photoFiles ?? []).map(
    ({ id }) =>
      `/api/v1/housekeeping/tasks/${encodeURIComponent(task.id)}/photos/${encodeURIComponent(id)}`,
  );
  const legacyPhotoUrls = Array.isArray(task.photos)
    ? task.photos.filter((photo): photo is string => typeof photo === "string")
    : [];

  return [
    ...new Set(
      [...photoFileUrls, task.photoUrl, ...legacyPhotoUrls].filter(
        (url): url is string => Boolean(url),
      ),
    ),
  ];
}

// --------------------------------------------------
// COMPONENT
// --------------------------------------------------

const HousekeepingReview = ({
  tasks,
  onTaskReviewed,
  title = "Housekeeping — awaiting approval",
  showViewAll = true,
  viewAllHref = "/Pages/HousekeepingReview",
  emptyMessage = "No housekeeping tasks awaiting approval.",
  maxItems,
}: HousekeepingReviewProps) => {
  const router = useRouter();

  const [selectedTask, setSelectedTask] =
    React.useState<HousekeepingTask | null>(null);

  const [activeModal, setActiveModal] = React.useState<ModalType>(null);
  const [resultType, setResultType] = React.useState<ResultType>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = React.useState(0);
  const [photoLoadState, setPhotoLoadState] = React.useState<
    "loading" | "loaded" | "error"
  >("loading");
  const [photoZoom, setPhotoZoom] = React.useState(1);
  const [photoZoomOrigin, setPhotoZoomOrigin] = React.useState("50% 50%");

  const [commentText, setCommentText] = React.useState("");

  // Prevent duplicate approve/reject requests
  const [isUpdatingTask, setIsUpdatingTask] = React.useState(false);

  // Error shown inside approve/reject modal
  const [taskActionError, setTaskActionError] = React.useState<string | null>(
    null,
  );

  const [portalReady, setPortalReady] = React.useState(false);

  React.useEffect(() => {
    setPortalReady(true);

    const id = "hk-review-fonts";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
  }, []);

  const visibleTasks =
    typeof maxItems === "number" ? tasks.slice(0, maxItems) : tasks;
  const selectedPhotoUrls = selectedTask
    ? getTaskPhotoUrls(selectedTask)
    : [];
  const selectedPhotoUrl = selectedPhotoUrls[selectedPhotoIndex];

  // --------------------------------------------------
  // API HELPER (with access-token refresh on 401)
  // --------------------------------------------------

  const sendReview = async (
    taskId: string,
    body: { action: ReviewAction; comment?: string },
  ) => {
    const request = () =>
      fetch(REVIEW_ENDPOINT(taskId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    let response = await request();

    // Refresh access token if necessary
    if (response.status === 401) {
      const refreshResponse = await fetch("/api/v1/auth/refresh", {
        method: "POST",
      });

      if (refreshResponse.ok) {
        response = await request();
      }
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error ?? `Unable to ${body.action} housekeeping task.`,
      );
    }

    return data;
  };

  // --------------------------------------------------
  // REVIEW
  // --------------------------------------------------

  const handleReview = async (action: ReviewAction) => {
    if (!selectedTask || isUpdatingTask) return;

    const comment = commentText.trim();

    if (action === "reject" && !comment) {
      setTaskActionError("A comment is required before rejecting a task.");
      return;
    }

    setIsUpdatingTask(true);
    setTaskActionError(null);

    try {
      await sendReview(selectedTask.id, {
        action,
        comment: comment || undefined,
      });
      await onTaskReviewed?.(selectedTask, action);

      setResultType(action === "approve" ? "approved" : "rejected");
      setActiveModal("success");
    } catch (error) {
      setTaskActionError(
        error instanceof Error
          ? error.message
          : `Unable to ${action} housekeeping task.`,
      );
    } finally {
      setIsUpdatingTask(false);
    }
  };

  // --------------------------------------------------
  // RESET MODAL
  // --------------------------------------------------

  const resetModalState = () => {
    if (isUpdatingTask) return;

    setActiveModal(null);
    setSelectedTask(null);
    setResultType(null);
    setSelectedPhotoIndex(0);
    setPhotoZoom(1);
    setPhotoZoomOrigin("50% 50%");
    setCommentText("");
    setTaskActionError(null);
  };

  const openModal = (
    task: HousekeepingTask,
    modal: ModalType,
    photoIndex = 0,
  ) => {
    setSelectedTask(task);
    setTaskActionError(null);
    if (modal === "photo") {
      setSelectedPhotoIndex(photoIndex);
      setPhotoLoadState("loading");
      setPhotoZoom(1);
      setPhotoZoomOrigin("50% 50%");
    }
    if (modal === "reject" || modal === "approve") setCommentText("");
    setActiveModal(modal);
  };

  const togglePhotoZoomAt = (x: number, y: number) => {
    if (photoZoom >= 3) {
      setPhotoZoom(1);
      setPhotoZoomOrigin("50% 50%");
      return;
    }

    if (photoZoom === 1) {
      setPhotoZoomOrigin(`${x}% ${y}%`);
    }
    setPhotoZoom((zoom) => Math.min(3, zoom + 1));
  };

  const togglePhotoZoom = (event: React.MouseEvent<HTMLImageElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    togglePhotoZoomAt(x, y);
  };

  const modal =
    activeModal && selectedTask ? (
      <div
        className={hk("modalOverlay", "hk-modalOverlay")}
        onClick={resetModalState}
      >
        <div
          className={hk("modal", "hk-modal")}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={hk("modalClose", "hk-modalClose")}
            onClick={resetModalState}
            disabled={isUpdatingTask}
            aria-label="Close"
          >
            ×
          </button>

          {activeModal !== "success" && (
            <h2 className={hk("modalTitle", "hk-modalTitle")}>
              {activeModal === "photo" && "Housekeeping Photo"}
              {activeModal === "reject" && "Reject Task"}
              {activeModal === "approve" && "Approve Task"}
            </h2>
          )}

          {activeModal !== "success" && (
            <p className={hk("modalRoom", "hk-modalRoom")}>
              Room {selectedTask.room?.roomNumber} •{" "}
              {selectedTask.room?.roomType}
            </p>
          )}

          {/* PHOTO MODAL */}
          {activeModal === "photo" && (
            <>
              <div className={hk("modalPhoto", "hk-modalPhoto")}>
                {selectedPhotoUrl && photoLoadState === "loading" && (
                  <div
                    className={hk("photoLoading", "hk-photoLoading")}
                    role="status"
                    aria-label="Loading photo"
                  >
                    <span
                      className={hk("photoSpinner", "hk-photoSpinner")}
                      aria-hidden="true"
                    />
                    <span>Loading photo...</span>
                  </div>
                )}
                {selectedPhotoUrl ? (
                  <img
                    className={`${hk("modalImg", "hk-modalImg")} ${
                      photoZoom >= 3
                        ? hk("zoomedPhoto", "hk-zoomedPhoto")
                        : ""
                    }`}
                    src={selectedPhotoUrl}
                    alt={`Housekeeping photo ${selectedPhotoIndex + 1} of ${selectedPhotoUrls.length} for room ${selectedTask.room?.roomNumber}`}
                    onLoad={() => setPhotoLoadState("loaded")}
                    onError={() => setPhotoLoadState("error")}
                    onClick={togglePhotoZoom}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        togglePhotoZoomAt(50, 50);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={
                      photoZoom >= 3
                        ? "Reset photo zoom"
                        : "Zoom in at pointer location"
                    }
                    style={{
                      visibility: photoLoadState === "loaded" ? "visible" : "hidden",
                      transform: `scale(${photoZoom})`,
                      transformOrigin: photoZoomOrigin,
                    }}
                  />
                ) : (
                  "Photo preview"
                )}
                {selectedPhotoUrl && photoLoadState === "error" && (
                  <span role="alert">Unable to load photo.</span>
                )}
              </div>
              {selectedPhotoUrls.length > 1 && (
                <div className={hk("photoControls", "hk-photoControls")}>
                  <button
                    type="button"
                    className={hk("photoNavButton", "hk-photoNavButton")}
                    onClick={() =>
                      {
                        setPhotoLoadState("loading");
                        setPhotoZoom(1);
                        setPhotoZoomOrigin("50% 50%");
                        setSelectedPhotoIndex(
                          (index) =>
                            (index - 1 + selectedPhotoUrls.length) %
                            selectedPhotoUrls.length,
                        );
                      }
                    }
                    aria-label="Previous photo"
                  >
                    Previous
                  </button>
                  <span>
                    {selectedPhotoIndex + 1} / {selectedPhotoUrls.length}
                  </span>
                  <button
                    type="button"
                    className={hk("photoNavButton", "hk-photoNavButton")}
                    onClick={() =>
                      {
                        setPhotoLoadState("loading");
                        setPhotoZoom(1);
                        setPhotoZoomOrigin("50% 50%");
                        setSelectedPhotoIndex(
                          (index) => (index + 1) % selectedPhotoUrls.length,
                        );
                      }
                    }
                    aria-label="Next photo"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}

          {/* REVIEW MODAL */}
          {(activeModal === "reject" || activeModal === "approve") && (
            <>
              <p className={hk("modalText", "hk-modalText")}>
                {activeModal === "reject"
                  ? "Are you sure you want to reject this housekeeping task?"
                  : "Are you sure you want to approve this housekeeping task?"}
              </p>

              <label
                className={hk("modalCommentLabel", "hk-modalCommentLabel")}
                htmlFor={`hk-review-comment-${selectedTask.id}`}
              >
                Comment {activeModal === "reject" ? "(required)" : "(optional)"}
              </label>
              <textarea
                className={hk("modalTextarea", "hk-modalTextarea")}
                id={`hk-review-comment-${selectedTask.id}`}
                placeholder={
                  activeModal === "reject"
                    ? "Explain what needs to be corrected..."
                    : "Leave a note for the housekeeper..."
                }
                value={commentText}
                onChange={(e) => {
                  setCommentText(e.target.value);
                  setTaskActionError(null);
                }}
                required={activeModal === "reject"}
                maxLength={250}
                disabled={isUpdatingTask}
              />

              {taskActionError && (
                <p className={hk("errorMessage", "hk-errorMessage")}>
                  {taskActionError}
                </p>
              )}

              <button
                type="button"
                className={
                  activeModal === "reject"
                    ? hk("modalRejectButton", "hk-modalRejectButton")
                    : hk("modalApproveButton", "hk-modalApproveButton")
                }
                onClick={() =>
                  handleReview(activeModal === "reject" ? "reject" : "approve")
                }
                disabled={isUpdatingTask}
              >
                {isUpdatingTask
                  ? activeModal === "reject"
                    ? "Rejecting..."
                    : "Approving..."
                  : activeModal === "reject"
                    ? "Reject Task"
                    : "Approve Task"}
              </button>
            </>
          )}

          {/* SUCCESS MODAL */}
          {activeModal === "success" && (
            <>
              <div
                className={`${hk("resultIcon", "hk-resultIcon")} ${
                  resultType === "approved"
                    ? hk("approvedIcon", "hk-approvedIcon")
                    : hk("rejectedIcon", "hk-rejectedIcon")
                }`}
              >
                {resultType === "rejected" ? "×" : "✓"}
              </div>

              <h3
                className={`${hk("resultTitle", "hk-resultTitle")} ${
                  resultType === "approved"
                    ? hk("approvedTitle", "hk-approvedTitle")
                    : hk("rejectedTitle", "hk-rejectedTitle")
                }`}
              >
                {resultType === "approved"
                  ? "Task Approved"
                  : "Task Rejected"}
              </h3>

              <p className={hk("modalSuccessText", "hk-modalSuccessText")}>
                {resultType === "approved"
                  ? "The housekeeping task has been approved."
                  : "The housekeeping task has been rejected."}
              </p>

              <button
                type="button"
                className={
                  resultType === "rejected"
                    ? hk("modalRejectButton", "hk-modalRejectButton")
                    : hk("modalApproveButton", "hk-modalApproveButton")
                }
                onClick={resetModalState}
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    ) : null;

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <section className={hk("housekeepingSection", "hk-housekeepingSection")}>
      <div className={hk("sectionHeader", "hk-sectionHeader")}>
        <h2 className={hk("sectionTitle", "hk-sectionTitle")}>{title}</h2>

        {showViewAll && (
          <button
            type="button"
            className={hk("viewAll", "hk-viewAll")}
            onClick={() => router.push(viewAllHref)}
          >
            View all
          </button>
        )}
      </div>

      <div className={hk("housekeepingList", "hk-housekeepingList")}>
        {visibleTasks.length === 0 ? (
          <div className={hk("emptyMessage", "hk-emptyMessage")}>
            {emptyMessage}
          </div>
        ) : (
          visibleTasks.map((task) => {
            const photoUrls = getTaskPhotoUrls(task);

            return (
              <article
                key={task.id}
                className={hk("housekeepingCard", "hk-housekeepingCard")}
              >
                {photoUrls.length > 0 ? (
                  <div
                    className={`${hk("photoStrip", "hk-photoStrip")} ${
                      photoUrls.length === 1
                        ? hk("singlePhotoStrip", "hk-singlePhotoStrip")
                        : ""
                    }`}
                    role="group"
                    aria-label={`${photoUrls.length} housekeeping photo${photoUrls.length === 1 ? "" : "s"} for room ${task.room?.roomNumber ?? ""}`}
                  >
                    {photoUrls.map((url, index) => (
                      <button
                        key={url}
                        type="button"
                        className={hk("photo", "hk-photo")}
                        onClick={() => openModal(task, "photo", index)}
                        aria-label={`View housekeeping photo ${index + 1} of ${photoUrls.length} for room ${task.room?.roomNumber ?? ""}`}
                      >
                        <img
                          className={hk("photoImg", "hk-photoImg")}
                          src={url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className={hk("photo", "hk-photo")}>
                    <span className={hk("photoFallback", "hk-photoFallback")}>
                      Photo
                    </span>
                  </div>
                )}

                <div className={hk("roomInfo", "hk-roomInfo")}>
                  <h3 className={hk("roomTitle", "hk-roomTitle")}>
                    Room {task.room?.roomNumber}
                  </h3>

                  <p className={hk("roomMeta", "hk-roomMeta")}>
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

                <div className={hk("actions", "hk-actions")}>
                  <button
                    type="button"
                    className={hk("rejectButton", "hk-reject")}
                    onClick={() => openModal(task, "reject")}
                  >
                    Reject
                  </button>

                  <button
                    type="button"
                    className={hk("approveButton", "hk-approve")}
                    onClick={() => openModal(task, "approve")}
                  >
                    Approve
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {modal && portalReady ? createPortal(modal, document.body) : modal}
    </section>
  );
};

export default HousekeepingReview;
