"use client";

import { useEffect, useId, useState } from "react";
import styles from "./AssignTaskModal.module.css";

type Housekeeper = {
  id: string;
  fullName: string;
  role: string;
};

type AssignTaskModalProps = {
  isOpen: boolean;
  roomId: string;
  roomNumber: string;
  onClose: () => void;
  onCreated?: () => void | Promise<void>;
  disableCloseButtons?: boolean;
};

export default function AssignTaskModal({
  isOpen,
  roomId,
  roomNumber,
  onClose,
  onCreated,
  disableCloseButtons = false,
}: AssignTaskModalProps) {
  const id = useId();
  const [housekeepers, setHousekeepers] = useState<Housekeeper[]>([]);
  const [selectedHousekeeperId, setSelectedHousekeeperId] = useState("");
  const [taskComment, setTaskComment] = useState("");
  const [isLoadingHousekeepers, setIsLoadingHousekeepers] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [taskCreated, setTaskCreated] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskSuccess, setTaskSuccess] = useState<string | null>(null);

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
          (staffUser) => staffUser.role === "HOUSEKEEPING",
        );

        if (!cancelled) {
          setHousekeepers(availableHousekeepers);
          setSelectedHousekeeperId(availableHousekeepers[0]?.id ?? "");
        }
      } catch (error) {
        if (!cancelled) {
          setTaskError(
            error instanceof Error
              ? error.message
              : "Unable to load housekeepers.",
          );
        }
      } finally {
        if (!cancelled) setIsLoadingHousekeepers(false);
      }
    }

    void loadHousekeepers();

    return () => {
      cancelled = true;
    };
  }, [housekeepers.length, isOpen]);

  function handleClose() {
    if (disableCloseButtons || isSavingTask) return;
    setTaskError(null);
    setTaskSuccess(null);
    onClose();
  }

  async function createTask() {
    if (taskCreated) {
      try {
        setIsSavingTask(true);
        setTaskError(null);
        await onCreated?.();
        setTaskSuccess("Cleaning task assigned and check-out completed.");
      } catch (error) {
        setTaskError(
          error instanceof Error
            ? error.message
            : "The task was assigned, but check-out failed.",
        );
      } finally {
        setIsSavingTask(false);
      }
      return;
    }

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
      if (onCreated) setTaskCreated(true);
      setTaskSuccess("Cleaning task assigned successfully.");
      await onCreated?.();
    } catch (error) {
      setTaskError(
        error instanceof Error ? error.message : "Unable to create the task.",
      );
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
            <h2 id={`${id}-title`}>Assign cleaning task</h2>
            <p className={styles.modalSubtitle}>
              Room {roomNumber} will be added to the selected housekeeper&apos;s
              queue.
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
        {taskSuccess && <p className={styles.modalSuccess}>{taskSuccess}</p>}

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
              (!taskCreated && housekeepers.length === 0)
            }
          >
            {isSavingTask
              ? taskCreated
                ? "Checking out..."
                : "Assigning..."
              : taskCreated
                ? "Retry check-out"
                : "Assign task"}
          </button>
        </div>
      </section>
    </div>
  );
}
