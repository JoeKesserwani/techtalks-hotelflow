"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./AddGuestModal.module.css";

export default function AddGuestModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  // Only render the portal once mounted in the browser — document.body
  // doesn't exist during server rendering.
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  // While the modal is open: lock page scroll and trap Tab/Shift+Tab focus
  // inside the modal, so the sidebar (and everything else behind the
  // overlay) is unreachable by keyboard, not just visually covered.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const firstField = modalRef.current?.querySelector<HTMLElement>(
      "input, textarea, button",
    );
    firstField?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key !== "Tab" || !modalRef.current) return;

      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'input, textarea, button, [href], select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  async function handleSave() {
    setError(null);
    setIsSaving(true);

    try {
      const res = await fetch("/api/v1/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone: phone || undefined,
          email: email || undefined,
          passportNumber: passportNumber || undefined,
          note: note || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not save guest");
        return;
      }

      onCreated?.();
      onClose();
      // Ideally trigger a re-fetch of the guests list here (e.g. via a
      // callback prop or a shared data layer) so the new guest shows up
      // without a full page reload.
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isMounted) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={modalRef}
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>New guest profile</h3>
        <p className={styles.subtitle}>
          No match found — add their details below.
        </p>

        <div className={styles.steps}>
          <span className={styles.stepInactive}>1 Find guest</span>
          <span className={styles.stepActive}>2 Reservation details</span>
        </div>

        <div className={styles.selectedChip}>
          <span className={styles.chipAvatar}>GS</span>
          <div className={styles.chipText}>
            <strong>{fullName || "Guest's name"}</strong>
            <span>
              {phone || "Phone number"} - {passportNumber || "ID"}
            </span>
          </div>
          <span className={styles.selectedTag}>selected</span>
          <button type="button" className={styles.changeLink} onClick={onClose}>
            change
          </button>
        </div>

        <label className={styles.label} htmlFor="fullName">
          Full Name
        </label>
        <input
          id="fullName"
          className={styles.input}
          placeholder="full guest's name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={20}
        />

        <div className={styles.row}>
          <div className={styles.col}>
            <label className={styles.label} htmlFor="phone">
              Phone number
            </label>
            <input
              id="phone"
              className={styles.input}
              placeholder="+961 12345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
            />
          </div>
          <div className={styles.col}>
            <label className={styles.label} htmlFor="passport">
              Passport Number
            </label>
            <input
              id="passport"
              className={styles.input}
              placeholder="XXXXXXXXXX"
              value={passportNumber}
              onChange={(e) => setPassportNumber(e.target.value)}
              maxLength={10}
            />
          </div>
        </div>

        <label className={styles.label} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className={styles.input}
          placeholder="XXXX@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={40}
        />

        <label className={styles.label} htmlFor="note">
          Note
        </label>
        <textarea
          id="note"
          className={styles.textarea}
          placeholder="Notes"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={250}
        />

        {error && <p className={styles.errorText}>{error}</p>}

        <div className={styles.actions}>
          <button type="button" className={styles.backButton} onClick={onClose}>
            Back to search
          </button>
          <button
            type="button"
            className={styles.saveButton}
            onClick={handleSave}
            disabled={isSaving || !fullName}
          >
            {isSaving ? "Saving..." : "Save & Continue"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
