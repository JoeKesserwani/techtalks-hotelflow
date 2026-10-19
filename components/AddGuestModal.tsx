
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
  const [isMounted, setIsMounted] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const firstField = modalRef.current?.querySelector<HTMLElement>(
      "input, textarea, button",
    );
    firstField?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSaving) {
        onClose();
        return;
      }

      if (e.key !== "Tab" || !modalRef.current) return;

      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'input:not(:disabled), textarea:not(:disabled), button:not(:disabled), [href], select, [tabindex]:not([tabindex="-1"])',
      );

      if (!focusable.length) return;

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
  }, [isMounted, isSaving, onClose]);

  async function handleSave() {
    const trimmedName = fullName.trim();

    if (!trimmedName) {
      setError("Please enter the guest's full name.");
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const res = await fetch("/api/v1/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: trimmedName,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          passportNumber: passportNumber.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not save guest.");
        return;
      }

      onClose();
      onCreated?.();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  const guestInitials =
    fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "G";

  if (!isMounted) return null;

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-modal-title"
        aria-describedby="guest-modal-description"
      >
        <div className={styles.modalHeader}>
          <div className={styles.headingGroup}>
            <span className={styles.eyebrow}>GUEST MANAGEMENT</span>
            <h2 id="guest-modal-title">New guest profile</h2>
            <p id="guest-modal-description" className={styles.subtitle}>
              Add guest information to your hotel records.
            </p>
          </div>

          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close new guest form"
          >
            ×
          </button>
        </div>

        <div className={styles.guestPreview}>
          <div className={styles.chipAvatar} aria-hidden="true">
            {guestInitials}
          </div>

          <div className={styles.chipText}>
            <strong>{fullName.trim() || "Guest name"}</strong>
            <span>
              {phone.trim() || "Phone number not added"}
            </span>
          </div>

          <span className={styles.previewLabel}>NEW PROFILE</span>
        </div>

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fullName">
              Full name <span className={styles.required}>*</span>
            </label>
            <input
              id="fullName"
              className={styles.input}
              placeholder="Enter the guest's full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={100}
              autoComplete="name"
              required
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="phone">
                Phone number
              </label>
              <input
                id="phone"
                className={styles.input}
                type="tel"
                placeholder="+961 XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={20}
                autoComplete="tel"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="passport">
                Passport number
              </label>
              <input
                id="passport"
                className={styles.input}
                placeholder="Enter passport number"
                value={passportNumber}
                onChange={(e) => setPassportNumber(e.target.value)}
                maxLength={10}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              className={styles.input}
              type="email"
              placeholder="guest@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={40}
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="note">
              Notes <span className={styles.optional}>(optional)</span>
            </label>
            <textarea
              id="note"
              className={styles.textarea}
              placeholder="Add any relevant information about this guest..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={250}
              rows={3}
            />
            <span className={styles.characterCount}>
              {note.length}/250
            </span>
          </div>
        </div>

        {error && (
          <p className={styles.errorText} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>

          <button
            type="button"
            className={styles.saveButton}
            onClick={handleSave}
            disabled={isSaving || !fullName.trim()}
          >
            {isSaving ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                Saving...
              </>
            ) : (
              "Save guest"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
