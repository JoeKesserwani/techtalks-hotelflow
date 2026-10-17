"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import styles from "./PopupMessage.module.css";

export type PopupMessageKind = "success" | "error" | "warning" | "info";

export type PopupMessageInput = {
  kind: PopupMessageKind;
  title: string;
  description?: string;
  duration?: number;
};

export type ReservationFeedback = {
  status: "success" | "error";
  title: string;
  message?: string;
};

type PopupMessageNotice = PopupMessageInput & { id: number };
type PopupMessageContextValue = {
  notify: (message: PopupMessageInput) => void;
};

const PopupMessageContext = createContext<PopupMessageContextValue | null>(
  null,
);

export function PopupMessageProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<PopupMessageNotice[]>([]);
  const nextId = useRef(0);

  const notify = useCallback((message: PopupMessageInput) => {
    const notice = { ...message, id: ++nextId.current };
    setNotices((current) => [...current, notice].slice(-5));
  }, []);

  const notice = notices[0];

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(
      () =>
        setNotices((current) =>
          current[0]?.id === notice.id ? current.slice(1) : current,
        ),
      notice.duration ?? 4500,
    );
    return () => window.clearTimeout(timeout);
  }, [notice]);

  return (
    <PopupMessageContext.Provider value={{ notify }}>
      {children}
      {notice && (
        <PopupMessageCard
          key={notice.id}
          notice={notice}
          onDismiss={() =>
            setNotices((current) =>
              current[0]?.id === notice.id ? current.slice(1) : current,
            )
          }
        />
      )}
    </PopupMessageContext.Provider>
  );
}

export function usePopupMessage() {
  const context = useContext(PopupMessageContext);
  if (!context) {
    throw new Error("usePopupMessage must be used within PopupMessageProvider");
  }
  return context;
}

function PopupMessageCard({
  notice,
  onDismiss,
}: {
  notice: PopupMessageNotice;
  onDismiss: () => void;
}) {
  const Icon = {
    success: CircleCheck,
    error: CircleAlert,
    warning: TriangleAlert,
    info: Info,
  }[notice.kind];
  const duration = notice.duration ?? 4500;
  const style = { "--popup-duration": `${duration}ms` } as CSSProperties;

  return (
    <div
      className={`${styles.popup} ${styles[notice.kind]}`}
      role={notice.kind === "error" ? "alert" : "status"}
      aria-live={notice.kind === "error" ? "assertive" : "polite"}
      style={style}
    >
      <span className={styles.icon} aria-hidden="true">
        <Icon size={22} strokeWidth={2} />
      </span>
      <div className={styles.copy}>
        <strong className={styles.title}>{notice.title}</strong>
        {notice.description && (
          <p className={styles.description}>{notice.description}</p>
        )}
      </div>
      <button
        className={styles.dismiss}
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        <X size={18} />
      </button>
      <span className={styles.progress} aria-hidden="true" />
    </div>
  );
}
