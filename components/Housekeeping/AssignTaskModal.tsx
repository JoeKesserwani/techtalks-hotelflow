"use client";

import { useEffect, useId, useState } from "react";
import { usePopupMessage } from "@/components/PopupMessage";
import styles from "./AssignTaskModal.module.css";

type Housekeeper = {
  id: string;
  fullName: string;
  role: string;
  isActive: boolean | 0 | 1;
};


type AssignTaskModalProps = {
  isOpen: boolean;
  roomId: string;
  roomNumber: string;
  taskId?: string;
  currentHousekeeperId?: string;
  onClose: () => void;
  onBeforeCreate?: () => void | Promise<void>;
  onCreated?: () => void | Promise<void>;
  disableCloseButtons?: boolean;
};


export default function AssignTaskModal({
  isOpen,
  roomId,
  roomNumber,
  taskId,
  currentHousekeeperId,
  onClose,
  onBeforeCreate,
  onCreated,
  disableCloseButtons = false,
}: AssignTaskModalProps) {
  const { notify } = usePopupMessage();
  const id = useId();
  const [housekeepers, setHousekeepers] = useState<Housekeeper[]>([]);
  const [selectedHousekeeperId, setSelectedHousekeeperId] = useState("");
  const [taskComment, setTaskComment] = useState("");
  const [isLoadingHousekeepers, setIsLoadingHousekeepers] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || housekeepers.length > 0) return;

    let cancelled = false;

    async function loadHousekeepers() {
      setIsLoadingHousekeepers(true);

      try {
        const response = await fetch("/api/v1/users");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load housekeepers.");
        }

        const availableHousekeepers = (data as Housekeeper[]).filter(
          (staffUser) =>
            staffUser.role === "HOUSEKEEPING" &&
            (staffUser.isActive === true || staffUser.isActive === 1),
        );

        if (!cancelled) {
          setHousekeepers(availableHousekeepers);
          setSelectedHousekeeperId(
  availableHousekeepers.some(
    (housekeeper) => housekeeper.id === currentHousekeeperId,
  )
    ? currentHousekeeperId!
    : availableHousekeepers[0]?.id ?? "",
);
        }
      } catch (error) {
        if (!cancelled) {
          notify({
            kind: "error",
            title: "Housekeepers could not be loaded",
            description:
              error instanceof Error
                ? error.message
                : "Unable to load housekeepers.",
          });
        }
      } finally {
        if (!cancelled) setIsLoadingHousekeepers(false);
      }
    }

    void loadHousekeepers();

    return () => {
      cancelled = true;
    };
  }, [housekeepers.length, isOpen, currentHousekeeperId]);

  function handleClose() {
    if (disableCloseButtons || isSavingTask) return;
    setTaskError(null);
    onClose();
  }

 
async function createTask() {
  if (!selectedHousekeeperId) {
    setTaskError("Select a housekeeper before assigning the task.");
    return;
  }

  if (taskId && selectedHousekeeperId === currentHousekeeperId) {
    setTaskError("Select a different housekeeper to reassign this task.");
    return;
  }

  setIsSavingTask(true);
  setTaskError(null);

  let checkoutComplete = false;

  try {
    // Only perform checkout when creating a new task.
    if (!taskId) {
      await onBeforeCreate?.();
    }

    checkoutComplete = true;

    const isReassignment = Boolean(taskId);

    const response = await fetch("/api/v1/housekeeping/tasks", {
      method: isReassignment ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isReassignment
          ? {
              taskId,
              assignedToUserId: selectedHousekeeperId,
            }
          : {
              roomId,
              assignedToUserId: selectedHousekeeperId,
              notes: taskComment.trim() || undefined,
            },
      ),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ??
          (isReassignment
            ? "Unable to reassign the task."
            : "Unable to create the task."),
      );
    }

    setTaskComment("");
    await onCreated?.();

    notify({
      kind: "success",
      title: isReassignment
        ? "Housekeeping task reassigned"
        : "Cleaning task assigned",
    });

    onClose();
  } catch (error) {
    notify({
      kind: "error",
      title:
        !taskId && onBeforeCreate && !checkoutComplete
          ? "Check-out failed"
          : taskId
            ? "Task was not reassigned"
            : "Cleaning task was not assigned",
      description:
        error instanceof Error
          ? error.message
          : "Something went wrong.",
    });
  } finally {
    setIsSavingTask(false);
  }
}


  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <section
        className={styles.taskModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
      >
        <div className={styles.modalHeader}>
          <div>
            <p className={styles.cardLabel}>HOUSEKEEPING</p>
            <h2 id={`${id}-title`}>
  {taskId ? "Reassign cleaning task" : "Assign cleaning task"}
</h2>
            <p className={styles.modalSubtitle}>
  {taskId
    ? `Change the housekeeper assigned to Room ${roomNumber}.`
    : `Room ${roomNumber} will be added to the selected housekeeper's queue.`}
</p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Close assign task dialog"
            disabled={disableCloseButtons || isSavingTask}
          >
            ×
          </button>
        </div>

        <label className={styles.modalLabel} htmlFor={`${id}-housekeeper`}>
          Assign to
        </label>
        <select
          id={`${id}-housekeeper`}
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

        <label className={styles.modalLabel} htmlFor={`${id}-task-comment`}>
          Comment
        </label>
        <textarea
          id={`${id}-task-comment`}
          className={styles.modalTextarea}
          placeholder="Add instructions for the housekeeper"
          maxLength={250}
          value={taskComment}
          onChange={(event) => setTaskComment(event.target.value)}
          disabled={isSavingTask}
        />
        <span className={styles.characterCount}>{taskComment.length}/250</span>

        {taskError && <p className={styles.modalError}>{taskError}</p>}

        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.modalCancel}
            onClick={handleClose}
            disabled={disableCloseButtons || isSavingTask}
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
            {isSavingTask
  ? "Processing..."
  : taskId
    ? "Reassign task"
    : "Assign task"}
          </button>
        </div>
      </section>
    </div>
  );
}
