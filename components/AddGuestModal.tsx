
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopupMessage } from "@/components/PopupMessage";
import styles from "./AddGuestModal.module.css";

export default function AddGuestModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: () => void;
}) {
  const { notify } = usePopupMessage();
  const [fullName, setFullName] = useState("");
  const initials =
    fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "GS";
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
        notify({
          kind: "error",
          title: "Guest was not added",
          description: data.error ?? "Could not save guest.",
        });
        return;
      }

      onClose();
      onCreated?.();
      notify({ kind: "success", title: "Guest added" });
      onClose();
      // Ideally trigger a re-fetch of the guests list here (e.g. via a
      // callback prop or a shared data layer) so the new guest shows up
      // without a full page reload.
    } catch {
      notify({
        kind: "error",
        title: "Guest was not added",
        description: "Something went wrong. Please try again.",
      });
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
        onClick={(e) => e.stopPropagation()}
      >
        <h3>New guest profile</h3>
        <div className={styles.selectedChip}>
          <span className={styles.chipAvatar}>{initials}</span>
          <div className={styles.chipText}>
            <strong>{fullName || "Guest's name"}</strong>
            <span>
              {phone || "Phone number"} - {passportNumber || "ID"}
            </span>
          </div>
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
          </div>

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
      </div>
    </div>,
    document.body
  );
}
