"use client";

import { useEffect } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import styles from "./ReservationFeedbackPopup.module.css";

export type ReservationFeedback = {
  status: "success" | "error";
  title: string;
  message?: string;
};

export function ReservationFeedbackPopup({
  feedback,
  onDismiss,
}: {
  feedback: ReservationFeedback | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(
      onDismiss,
      feedback.status === "error" ? 7000 : 4000,
    );
    return () => window.clearTimeout(timeout);
  }, [feedback, onDismiss]);

  if (!feedback) return null;

  const Icon = feedback.status === "success" ? CircleCheck : CircleAlert;

  return (
    <div
      className={`${styles.popup} ${feedback.status === "success" ? styles.success : styles.error}`}
      role={feedback.status === "error" ? "alert" : "status"}
      aria-live={feedback.status === "error" ? "assertive" : "polite"}
    >
      <span className={styles.icon} aria-hidden="true">
        <Icon size={22} strokeWidth={2} />
      </span>
      <div className={styles.copy}>
        <strong>{feedback.title}</strong>
        {feedback.message && <p>{feedback.message}</p>}
      </div>
      <button
        className={styles.dismiss}
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        <X size={18} />
      </button>
    </div>
  );
}
