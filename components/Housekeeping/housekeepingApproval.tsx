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

  /** Show the Comment button on each row. Defaults to true. */
  showComment?: boolean;
}

type ModalType = "photo" | "comment" | "reject" | "approve" | "success" | null;
type ResultType = "approved" | "rejected" | "comment" | null;

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

function getTaskPhotoUrl(task: HousekeepingTask) {
  if (task.photoUrl) return task.photoUrl;
  if (!Array.isArray(task.photos)) return undefined;
  return task.photos.find(
    (photo): photo is string => typeof photo === "string",
  );
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
  showComment = true,
}: HousekeepingReviewProps) => {
  const router = useRouter();

  const [selectedTask, setSelectedTask] =
    React.useState<HousekeepingTask | null>(null);

  const [activeModal, setActiveModal] = React.useState<ModalType>(null);
  const [resultType, setResultType] = React.useState<ResultType>(null);

  const [commentText, setCommentText] = React.useState("");
  const [rejectionReason, setRejectionReason] = React.useState("");

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
  const selectedPhotoUrl = selectedTask
    ? getTaskPhotoUrl(selectedTask)
    : undefined;

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
  // APPROVE
  //   Backend: Task IN_REVIEW -> DONE, Room IN_REVIEW -> AVAILABLE
  // --------------------------------------------------

  const handleApprove = async () => {
    if (!selectedTask || isUpdatingTask) return;

    setIsUpdatingTask(true);
    setTaskActionError(null);

    try {
      await sendReview(selectedTask.id, { action: "approve" });
      await onTaskReviewed?.(selectedTask, "approve");

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
  // REJECT
  //   Backend: Task IN_REVIEW -> PENDING, Room IN_REVIEW -> NEEDS_CLEANING
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
      await sendReview(selectedTask.id, {
        action: "reject",
        comment: reason,
      });
      await onTaskReviewed?.(selectedTask, "reject");

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

  const openModal = (task: HousekeepingTask, modal: ModalType) => {
    setSelectedTask(task);
    setTaskActionError(null);
    if (modal === "reject") setRejectionReason("");
    setActiveModal(modal);
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
              {activeModal === "comment" && "Add Comment"}
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
            <div className={hk("modalPhoto", "hk-modalPhoto")}>
              {selectedPhotoUrl ? (
                <img
                  className={hk("modalImg", "hk-modalImg")}
                  src={selectedPhotoUrl}
                  alt={`Room ${selectedTask.room?.roomNumber}`}
                />
              ) : (
                "Photo preview"
              )}
            </div>
          )}

          {/* COMMENT MODAL */}
          {activeModal === "comment" && (
            <>
              <textarea
                className={hk("modalTextarea", "hk-modalTextarea")}
                placeholder="Write your comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />

              <button
                type="button"
                className={hk("sendCommentButton", "hk-sendCommentButton")}
                onClick={handleSendComment}
              >
                Send Comment
              </button>
            </>
          )}

          {/* REJECT MODAL */}
          {activeModal === "reject" && (
            <>
              <p className={hk("modalText", "hk-modalText")}>
                Are you sure you want to reject this housekeeping task?
              </p>

              <textarea
                className={hk("modalTextarea", "hk-modalTextarea")}
                placeholder="Reason for rejection..."
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                  setTaskActionError(null);
                }}
                disabled={isUpdatingTask}
              />

              {taskActionError && (
                <p className={hk("errorMessage", "hk-errorMessage")}>
                  {taskActionError}
                </p>
              )}

              <button
                type="button"
                className={hk("modalRejectButton", "hk-modalRejectButton")}
                onClick={handleReject}
                disabled={isUpdatingTask}
              >
                {isUpdatingTask ? "Rejecting..." : "Reject Task"}
              </button>
            </>
          )}

          {/* APPROVE MODAL */}
          {activeModal === "approve" && (
            <>
              <p className={hk("modalText", "hk-modalText")}>
                Are you sure you want to approve this housekeeping task?
              </p>

              {taskActionError && (
                <p className={hk("errorMessage", "hk-errorMessage")}>
                  {taskActionError}
                </p>
              )}

              <button
                type="button"
                className={hk("modalApproveButton", "hk-modalApproveButton")}
                onClick={handleApprove}
                disabled={isUpdatingTask}
              >
                {isUpdatingTask ? "Approving..." : "Approve Task"}
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
                    : resultType === "rejected"
                      ? hk("rejectedIcon", "hk-rejectedIcon")
                      : hk("commentIcon", "hk-commentIcon")
                }`}
              >
                {resultType === "rejected" ? "×" : "✓"}
              </div>

              <h3
                className={`${hk("resultTitle", "hk-resultTitle")} ${
                  resultType === "approved"
                    ? hk("approvedTitle", "hk-approvedTitle")
                    : resultType === "rejected"
                      ? hk("rejectedTitle", "hk-rejectedTitle")
                      : hk("commentTitle", "hk-commentTitle")
                }`}
              >
                {resultType === "approved"
                  ? "Task Approved"
                  : resultType === "rejected"
                    ? "Task Rejected"
                    : "Comment Sent"}
              </h3>

              <p className={hk("modalSuccessText", "hk-modalSuccessText")}>
                {resultType === "approved"
                  ? "The housekeeping task has been approved."
                  : resultType === "rejected"
                    ? "The housekeeping task has been rejected."
                    : "Your comment has been sent to the cleaner."}
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
            const photoUrl = getTaskPhotoUrl(task);

            return (
              <article
                key={task.id}
                className={hk("housekeepingCard", "hk-housekeepingCard")}
              >
                <button
                  type="button"
                  className={hk("photo", "hk-photo")}
                  onClick={() => openModal(task, "photo")}
                  aria-label={`View housekeeping photo for room ${task.room?.roomNumber ?? ""}`}
                >
                  {photoUrl ? (
                    <img
                      className={hk("photoImg", "hk-photoImg")}
                      src={photoUrl}
                      alt=""
                    />
                  ) : (
                    <span className={hk("photoFallback", "hk-photoFallback")}>
                      Photo
                    </span>
                  )}
                </button>

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
                  {showComment && (
                    <button
                      type="button"
                      className={hk("commentButton", "hk-comment")}
                      onClick={() => openModal(task, "comment")}
                    >
                      Comment
                    </button>
                  )}

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
