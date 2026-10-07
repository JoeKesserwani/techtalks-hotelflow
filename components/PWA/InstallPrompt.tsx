"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import styles from "./InstallPrompt.module.css";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }

  interface Navigator {
    standalone?: boolean;
  }
}

function subscribeToNoEvents() {
  return () => {};
}

function subscribeToInstallStatus(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const displayMode = window.matchMedia("(display-mode: standalone)");
  window.addEventListener("appinstalled", onStoreChange);
  displayMode.addEventListener("change", onStoreChange);

  return () => {
    window.removeEventListener("appinstalled", onStoreChange);
    displayMode.removeEventListener("change", onStoreChange);
  };
}

function getIsIOS() {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = window.navigator.userAgent;
  return (
    /iPhone|iPad|iPod/.test(userAgent) ||
    (window.navigator.platform === "MacIntel" &&
      window.navigator.maxTouchPoints > 1)
  );
}

function getIsStandalone() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function getServerSnapshot() {
  return false;
}

export default function InstallPrompt() {
  const isIOS = useSyncExternalStore(
    subscribeToNoEvents,
    getIsIOS,
    getServerSnapshot,
  );
  const isStandalone = useSyncExternalStore(
    subscribeToInstallStatus,
    getIsStandalone,
    getServerSnapshot,
  );
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    function handleBeforeInstallPrompt(event: BeforeInstallPromptEvent) {
      event.preventDefault();
      setInstallEvent(event);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  if (isStandalone || (!isIOS && !installEvent && !message)) {
    return null;
  }

  async function handleInstall() {
    if (!installEvent) {
      setShowIOSInstructions((isVisible) => !isVisible);
      return;
    }

    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      setInstallEvent(null);

      if (choice.outcome === "dismissed") {
        setMessage("You can install HotelFlow from your browser menu.");
      }
    } catch {
      setInstallEvent(null);
      setMessage("Use your browser menu to install HotelFlow.");
    }
  }

  return (
    <div className={styles.installPrompt}>
      {isIOS ? (
        <button
          className={styles.installButton}
          type="button"
          aria-expanded={showIOSInstructions}
          onClick={handleInstall}
        >
          Add HotelFlow to your Home Screen
        </button>
      ) : installEvent ? (
        <button
          className={styles.installButton}
          type="button"
          onClick={handleInstall}
        >
          Install HotelFlow
        </button>
      ) : null}

      {showIOSInstructions && isIOS && (
        <p className={styles.instructions} role="status">
          Tap the Share button in your browser, then choose “Add to Home
          Screen”.
        </p>
      )}
      {message && (
        <p className={styles.instructions} role="status">
          {message}
        </p>
      )}
    </div>
  );
}
