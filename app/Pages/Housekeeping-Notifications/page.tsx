"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./HousekeepingNotifications.module.css";
import { useAuth } from "@/components/Auth/AuthProvider";
import Header from "@/components/Header/Header";

type NotificationTab = "all" | "unread" | "read";
type NotificationTone = "created" | "approved" | "rejected";

type ApiNotification = {
  id: string;
  title: string;
  message: string;
  type: "TASK_ASSIGNED" | "TASK_APPROVED" | "TASK_REJECTED";
  isRead: boolean;
  createdAt: string;
  taskId: string | null;
  detail?: string | null;
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  category: "Task" | "Review" | "Reminder";
  tone: NotificationTone;
  taskId?: string | null;
  detail?: string;
};

type TaskPreview = {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  notes: string | null;
  room: {
    roomNumber: string;
    roomType: string;
  };
  photos: unknown;
};

function mapNotificationType(type: ApiNotification["type"]): NotificationTone {
  if (type === "TASK_APPROVED") return "approved";
  if (type === "TASK_REJECTED") return "rejected";
  return "created";
}

function getNotificationCategory(type: ApiNotification["type"]): NotificationItem["category"] {
  if (type === "TASK_APPROVED" || type === "TASK_REJECTED") return "Review";
  if (type === "TASK_ASSIGNED") return "Task";
  return "Reminder";
}

function getNotificationDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatNotificationGroupLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (getNotificationDateKey(date) === getNotificationDateKey(today)) {
    return "Today";
  }

  if (getNotificationDateKey(date) === getNotificationDateKey(yesterday)) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(date);
}

function formatNotificationTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
  }).format(new Date(value));
}

export default function HousekeepingNotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskPreview | null>(null);
  const [taskPreviewError, setTaskPreviewError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NotificationTab>("all");

  useEffect(() => {
    async function loadNotifications() {
      try {
        const response = await fetch("/api/v1/notifications");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load notifications.");
        }

        setNotifications(
          (data as ApiNotification[]).map((item) => ({
            id: item.id,
            title: item.title,
            message: item.message,
            createdAt: item.createdAt,
            isRead: item.isRead,
            category: getNotificationCategory(item.type),
            tone: mapNotificationType(item.type),
            taskId: item.taskId,
            detail: item.detail ?? undefined,
          })),
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load notifications.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadNotifications();
  }, []);

  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const readCount = notifications.length - unreadCount;

  const visibleNotifications = useMemo(() => {
    if (activeTab === "unread") {
      return notifications.filter((item) => !item.isRead);
    }

    if (activeTab === "read") {
      return notifications.filter((item) => item.isRead);
    }

    return notifications;
  }, [activeTab, notifications]);

  const notificationGroups = useMemo(() => {
    const groups = new Map<string, NotificationItem[]>();

    for (const notification of visibleNotifications) {
      const dateKey = getNotificationDateKey(notification.createdAt);
      const group = groups.get(dateKey) ?? [];
      group.push(notification);
      groups.set(dateKey, group);
    }

    return [...groups.entries()]
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .map(([dateKey, items]) => ({
        dateKey,
        label: formatNotificationGroupLabel(items[0].createdAt),
        notifications: items,
      }));
  }, [visibleNotifications]);

  useEffect(() => {
    if (!selectedTaskId) {
      setSelectedTask(null);
      setTaskPreviewError(null);
      return;
    }

    let ignore = false;

    async function loadTaskPreview() {
      try {
        const response = await fetch(`/api/v1/housekeeping/tasks/${selectedTaskId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load task details.");
        }

        if (!ignore) {
          setSelectedTask(data as TaskPreview);
          setTaskPreviewError(null);
        }
      } catch (taskError) {
        if (!ignore) {
          setTaskPreviewError(
            taskError instanceof Error ? taskError.message : "Unable to load task details.",
          );
          setSelectedTask(null);
        }
      }
    }

    loadTaskPreview();

    return () => {
      ignore = true;
    };
  }, [selectedTaskId]);

  function handleViewTask(notification: NotificationItem) {
    if (!notification.taskId) {
      setTaskPreviewError("No task is attached to this notification.");
      setSelectedTask(null);
      setSelectedTaskId(null);
      return;
    }

    setSelectedTaskId(notification.taskId);
  }

  async function markAsRead(id: string) {
    try {
      const response = await fetch(`/api/v1/notifications/${id}`, {
        method: "PATCH",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Unable to mark the notification as read.");
      }

      setNotifications((current) =>
        current.map((item) =>
          item.id === id ? { ...item, isRead: true } : item,
        ),
      );
    } catch (markError) {
      setError(
        markError instanceof Error ? markError.message : "Unable to mark the notification as read.",
      );
    }
  }

  return (
    <main className={styles.page}>
      
      <div className={styles.container}>
        {Header({
          title: "Housekeeping Notifications",
          subtitle: `${unreadCount} unread - ${readCount} read`,
          userSubtitle: "Currently reviewing notifications",
        })}
        <nav className={styles.tabs} aria-label="Notification filters">
          {[
            { key: "all", label: "All" },
            { key: "unread", label: "Unread" },
            { key: "read", label: "Read" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`${styles.tab} ${activeTab === tab.key ? styles.activeTab : ""}`}
              onClick={() => setActiveTab(tab.key as NotificationTab)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className={styles.tabHeader}>
          <p>
            {activeTab === "all"
              ? "All notifications"
              : activeTab === "unread"
                ? "Unread updates"
                : "Read notifications"}
          </p>
        </div>

        <section className={styles.taskList}>
          {isLoading ? (
            <div className={styles.emptyState}>
              <h2>Loading notifications…</h2>
              <p>Please wait while your latest updates load.</p>
            </div>
          ) : error ? (
            <div className={styles.emptyState}>
              <h2>Unable to load notifications</h2>
              <p>{error}</p>
            </div>
          ) : visibleNotifications.length === 0 ? (
            <div className={styles.emptyState}>
              <h2>No notifications</h2>
              <p>There are no notifications in this view.</p>
            </div>
          ) : (
            notificationGroups.map((group) => (
              <div key={group.dateKey} className={styles.dateGroup}>
                <h2 className={styles.dateHeading}>{group.label}</h2>
                <div className={styles.dateGroupNotifications}>
                  {group.notifications.map((notification) => (
                    <article
                      key={notification.id}
                      className={`${styles.taskCard} ${styles[notification.tone]} ${!notification.isRead ? styles.unread : ""}`}
                    >
                      <div className={styles.taskInfo}>
                        <div className={styles.notificationHeader}>
                          <h2>{notification.title}</h2>
                          <span
                            className={`${styles.statusBadge} ${styles[notification.tone]} ${
                              notification.isRead ? styles.readBadge : styles.unreadBadge
                            }`}
                          >
                            {notification.isRead ? "Read" : "New"}
                          </span>
                        </div>

                        <p>{notification.message}</p>
                        <small>
                          {notification.category} · {formatNotificationTime(notification.createdAt)}
                        </small>

                        {notification.detail && (
                          <div className={styles.comment}>
                            <strong>Details</strong>
                            <p>{notification.detail}</p>
                          </div>
                        )}
                      </div>

                      <div className={styles.actions}>
                        {!notification.isRead && (
                          <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={() => markAsRead(notification.id)}
                          >
                            Mark as read
                          </button>
                        )}
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => handleViewTask(notification)}
                        >
                          View task
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      {selectedTaskId && (
        <div className={styles.modalOverlay} onClick={() => setSelectedTaskId(null)}>
          <div className={styles.modalContent} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalLabel}>Task preview</p>
                <h2>Room {selectedTask?.room.roomNumber ?? "-"}</h2>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setSelectedTaskId(null)}
              >
                ×
              </button>
            </div>

            {taskPreviewError ? (
              <p className={styles.reviewError}>{taskPreviewError}</p>
            ) : selectedTask ? (
              <>
                <div className={styles.taskMeta}>
                  <span className={styles.metaPill}>{selectedTask.status}</span>
                  <span className={styles.metaText}>{selectedTask.room.roomType}</span>
                </div>

                <div className={styles.taskSection}>
                  <h3>Notes</h3>
                  <p>{selectedTask.notes || "No notes provided."}</p>
                </div>

                <div className={styles.taskSection}>
                  <h3>Pictures</h3>
                  {Array.isArray(selectedTask.photos) && selectedTask.photos.length > 0 ? (
                    <div className={styles.pictureGrid}>
                      {selectedTask.photos.map((photo, index) => (
                        <img
                          key={`${photo}-${index}`}
                          src={String(photo)}
                          alt={`Task room photo ${index + 1}`}
                          className={styles.previewImage}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className={styles.emptyPhotoText}>No photos attached.</p>
                  )}
                </div>
              </>
            ) : (
              <p className={styles.reviewError}>Loading task details…</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

