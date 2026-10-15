"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./HousekeepingHistory.module.css";
import { useAuth } from "@/components/Auth/AuthProvider";
import Pagination from "@/components/Pagination";

type HistoryStatus = "AWAITING_APPROVAL" | "COMPLETED";

type ReviewEvent = {
  action: "APPROVED";
  reviewedBy: string;
  reviewedAt: string;
  reviewNote: string;
};

type HistoryItem = {
  id: string;
  room: string;
  type: string;
  housekeeper: string;

  startedAt?: string;
  completedAt?: string;

  duration: string;
  photos: number;
  notes: string;

  status: HistoryStatus;
  reviewHistory: ReviewEvent[];
};

const ROWS_PER_PAGE = 5;

function HousekeepingHistoryPage() {
  const { user } = useAuth();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HistoryItem | null>(null);


const [activeTab, setActiveTab] =
  useState<HistoryStatus>("AWAITING_APPROVAL");

const [awaitingPage, setAwaitingPage] = useState(1);
const [completedPage, setCompletedPage] = useState(1);


  useEffect(() => {
    async function loadHistory() {
      try {
        const response = await fetch(
          "/api/v1/housekeeping/history"
        );

        if (!response.ok) {
          throw new Error(
            "Failed to load housekeeping history"
          );
        }

        const data = await response.json();

        const formattedHistory: HistoryItem[] =
          Array.isArray(data)
            ? data
                .filter(
                  (task: any) =>
                    task.historyStatus !== "REJECTED"
                )
                .map((task: any) => {
                  const reviewHistory =
                    getApprovedReviews(task);

                  const status: HistoryStatus =
                    task.historyStatus === "COMPLETED" ||
                    task.status === "DONE" ||
                    task.status === "COMPLETED"
                      ? "COMPLETED"
                      : "AWAITING_APPROVAL";

                  return {
                    id: task.id,

                    room:
                      task.room?.roomNumber ?? "â€”",

                    type:
                      task.room?.roomType ?? "â€”",

                    housekeeper:
                      task.assignedTo?.fullName ?? "â€”",

                    startedAt: task.startedAt,
                    completedAt: task.completedAt,

                    duration: calculateDuration(
                      task.startedAt,
                      task.completedAt
                    ),

                    photos: Array.isArray(task.photos)
                      ? task.photos.length
                      : 0,

                    notes: task.notes ?? "",

                    status,
                    reviewHistory,
                  };
                })
            : [];

        setHistory(formattedHistory);
      } catch (error) {
        console.error(
          "Failed to load housekeeping history:",
          error
        );
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  /* =======================================================
     GROUP HISTORY
  ======================================================= */

  const awaitingApproval = useMemo(
    () =>
      history.filter(
        (item) =>
          item.status === "AWAITING_APPROVAL"
      ),
    [history]
  );

  const completed = useMemo(
    () =>
      history.filter(
        (item) => item.status === "COMPLETED"
      ),
    [history]
  );

  const totalTasks = history.length;

  /* =======================================================
     PAGINATION
  ======================================================= */

  const awaitingTotalPages = Math.max(
    1,
    Math.ceil(
      awaitingApproval.length / ROWS_PER_PAGE
    )
  );

  const completedTotalPages = Math.max(
    1,
    Math.ceil(
      completed.length / ROWS_PER_PAGE
    )
  );

  const paginatedAwaiting = useMemo(() => {
    const start =
      (awaitingPage - 1) * ROWS_PER_PAGE;

    return awaitingApproval.slice(
      start,
      start + ROWS_PER_PAGE
    );
  }, [awaitingApproval, awaitingPage]);

  const paginatedCompleted = useMemo(() => {
    const start =
      (completedPage - 1) * ROWS_PER_PAGE;

    return completed.slice(
      start,
      start + ROWS_PER_PAGE
    );
  }, [completed, completedPage]);

  /* =======================================================
     RESET PAGE WHEN DATA CHANGES
  ======================================================= */

  useEffect(() => {
    if (awaitingPage > awaitingTotalPages) {
      setAwaitingPage(awaitingTotalPages);
    }
  }, [awaitingPage, awaitingTotalPages]);

  useEffect(() => {
    if (completedPage > completedTotalPages) {
      setCompletedPage(completedTotalPages);
    }
  }, [completedPage, completedTotalPages]);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main className={styles.page}>
      <div className={styles.container}>

        {/* Header */}
        <HistoryHeader user={user} />

{/* Content */}
{loading ? (
  <div className={styles.emptyState}>
    <p>Loading cleaning history...</p>
  </div>
) : totalTasks === 0 ? (
  <div className={styles.emptyState}>
    <div className={styles.emptyIcon}>âœ“</div>
    <h2>No housekeeping records yet</h2>
    <p>
      Completed and pending approval housekeeping
      tasks will appear here.
    </p>
  </div>
) : (
  <>
    {/* Navigation tabs â€” outside the scrolling area */}
    <nav
      className={styles.historyTabs}
      role="tablist"
      aria-label="Housekeeping history status"
    >
      <button
        type="button"
        role="tab"
        id="awaiting-tab"
        aria-selected={activeTab === "AWAITING_APPROVAL"}
        aria-controls="history-panel"
        className={`${styles.historyTab} ${
          activeTab === "AWAITING_APPROVAL"
            ? styles.activeHistoryTab
            : ""
        }`}
        onClick={() => setActiveTab("AWAITING_APPROVAL")}
      >
        <span>Awaiting Approval</span>
        <span className={styles.tabCount}>
          {awaitingApproval.length}
        </span>
      </button>

      <button
        type="button"
        role="tab"
        id="completed-tab"
        aria-selected={activeTab === "COMPLETED"}
        aria-controls="history-panel"
        className={`${styles.historyTab} ${
          activeTab === "COMPLETED"
            ? styles.activeHistoryTab
            : ""
        }`}
        onClick={() => setActiveTab("COMPLETED")}
      >
        <span>Completed</span>
        <span className={styles.tabCount}>
          {completed.length}
        </span>
      </button>
    </nav>

    {/* Scrollable history records */}
    <div className={styles.historyContent}>
      <div
        id="history-panel"
        role="tabpanel"
        aria-labelledby={
          activeTab === "AWAITING_APPROVAL"
            ? "awaiting-tab"
            : "completed-tab"
        }
      >
        {activeTab === "AWAITING_APPROVAL" ? (
          <HistorySection
            title="Awaiting Approval"
            description="Cleaning tasks completed by housekeeping and waiting for inspection."
            count={awaitingApproval.length}
            items={paginatedAwaiting}
            totalItems={awaitingApproval.length}
            currentPage={awaitingPage}
            totalPages={awaitingTotalPages}
            onPageChange={setAwaitingPage}
            emptyTitle="No tasks awaiting approval"
            emptyDescription="All completed housekeeping tasks have been reviewed."
            emptyIcon="waiting"
            variant="awaiting"
            onView={setSelected}
          />
        ) : (
          <HistorySection
            title="Completed"
            description="Cleaning tasks that were approved after inspection."
            count={completed.length}
            items={paginatedCompleted}
            totalItems={completed.length}
            currentPage={completedPage}
            totalPages={completedTotalPages}
            onPageChange={setCompletedPage}
            emptyTitle="No completed tasks yet"
            emptyDescription="Approved housekeeping tasks will appear here."
            emptyIcon="âœ“"
            variant="completed"
            onView={setSelected}
          />
        )}
      </div>
    </div>
  </>
)}

      </div>

      {/* Details Modal */}
      {selected && (
        <HistoryDetails
          item={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}
/* =========================================================
   HEADER
========================================================= */

function HistoryHeader({
  user,
}: {
  user: any;
}) {
  return (
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>
          HOUSEKEEPING
        </p>

        <h1 className={styles.title}>
          Cleaning History
        </h1>

        <p className={styles.subtitle}>
          A complete record of housekeeping work,
          inspections, and approvals.
        </p>
      </div>

      <div className={styles.role}>
        <div className={styles.roleInfo}>
          <strong>
            {user?.fullName ?? "â€”"}
          </strong>

          <span>
            Current housekeeping records
          </span>
        </div>

        <div className={styles.roleBadge}>
          {user?.role ?? "â€”"}
        </div>
      </div>
    </header>
  );
}

/* =========================================================
   HISTORY SECTION
========================================================= */

function HistorySection({
  title,
  description,
  count,
  items,
  totalItems,
  currentPage,
  totalPages,
  onPageChange,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  variant,
  onView,
}: {
  title: string;
  description: string;
  count: number;
  items: HistoryItem[];
  totalItems: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon: string;
  variant: "awaiting" | "completed";
  onView: (item: HistoryItem) => void;
}) {
  const groupedHistory =
    groupHistoryByDate(items);

  const isAwaiting =
    variant === "awaiting";

  const startItem =
    totalItems === 0
      ? 0
      : (currentPage - 1) * ROWS_PER_PAGE + 1;

  const endItem = Math.min(
    currentPage * ROWS_PER_PAGE,
    totalItems
  );

  return (
    <section
      className={`${styles.historySection} ${
        isAwaiting
          ? styles.awaitingSection
          : styles.completedSection
      }`}
    >
      {/* Section Header */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeading}>
          <div className={styles.sectionTitleRow}>
            <span
              className={`${styles.sectionIndicator} ${
                isAwaiting
                  ? styles.awaitingIndicator
                  : styles.completedIndicator
              }`}
              aria-hidden="true"
            >
              {isAwaiting ? (
                <span
                  className={styles.awaitingIcon}
                />
              ) : (
                "âœ“"
              )}
            </span>

            <h2>{title}</h2>
          </div>

          <p>{description}</p>
        </div>

        <span
          className={`${styles.totalCount} ${
            isAwaiting
              ? styles.awaitingCount
              : styles.completedCount
          }`}
        >
          {count} {count === 1 ? "task" : "tasks"}
        </span>
      </div>

      {/* Empty State */}
      {count === 0 ? (
        <div
          className={`${styles.sectionEmptyState} ${
            isAwaiting
              ? styles.awaitingEmptyState
              : styles.completedEmptyState
          }`}
        >
          <div className={styles.emptyIcon}>
            {emptyIcon === "waiting" ? (
              <span
                className={styles.emptyWaitingIcon}
                aria-hidden="true"
              />
            ) : (
              emptyIcon
            )}
          </div>

          <h3>{emptyTitle}</h3>

          {emptyDescription && (
            <p>{emptyDescription}</p>
          )}
        </div>
      ) : (
        <>
          {/* History */}
          <div className={styles.historyList}>
            {Object.entries(groupedHistory).map(
              ([dateLabel, dateItems]) => (
                <section
                  key={dateLabel}
                  className={styles.dateSection}
                >
                  <div className={styles.dateHeader}>
                    <div className={styles.dateTitle}>
                      <h3>{dateLabel}</h3>

                      <span>
                        {dateItems.length}
                      </span>
                    </div>

                    <div
                      className={styles.dateLine}
                    />
                  </div>

                  <div className={styles.taskList}>
                    {dateItems.map((item) => (
                      <HistoryRow
                        key={item.id}
                        item={item}
                        onView={() => onView(item)}
                      />
                    ))}
                  </div>
                </section>
              )
            )}
          </div>

  {/* Pagination */}
  <Pagination
    currentPage={currentPage}
    totalPages={totalPages}
    onPageChange={onPageChange}
    totalItems={totalItems}
    itemsPerPage={ROWS_PER_PAGE}
  />

        </>
      )}
    </section>
  );
}

/* =========================================================
   HISTORY ROW
========================================================= */

function HistoryRow({
  item,
  onView,
}: {
  item: HistoryItem;
  onView: () => void;
}) {
  return (
    <article className={styles.taskCard}>

      {/* Room */}
      <div className={styles.roomInfo}>
        <span className={styles.fieldLabel}>
          ROOM
        </span>

        <div className={styles.roomTitle}>
          <h2>{item.room}</h2>

          <StatusBadge status={item.status} />
        </div>

        <p>{item.type}</p>
      </div>

      {/* Housekeeper */}
      <div className={styles.taskInfoBlock}>
        <span className={styles.fieldLabel}>
          HOUSEKEEPER
        </span>

        <p className={styles.strongText}>
          {item.housekeeper}
        </p>
      </div>

      {/* Cleaning Time */}
      <div
        className={`${styles.taskInfoBlock} ${styles.timeBlock}`}
      >
        <span className={styles.fieldLabel}>
          CLEANING TIME
        </span>

        <p className={styles.strongText}>
          {formatTime(item.startedAt)}
          {" â€” "}
          {formatTime(item.completedAt)}
        </p>

        <small>{item.duration}</small>
      </div>

      {/* Photos */}
      <div
        className={`${styles.taskInfoBlock} ${styles.photoInfo}`}
      >
        <span className={styles.fieldLabel}>
          PHOTOS
        </span>

        <p className={styles.strongText}>
          {item.photos}
        </p>

        <small>submitted</small>
      </div>

      {/* Action */}
      <div className={styles.actions}>
        <button
          type="button"
          onClick={onView}
          className={styles.detailsButton}
        >
          View Details
        </button>
      </div>
    </article>
  );
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({
  status,
}: {
  status: HistoryStatus;
}) {
  const isAwaiting =
    status === "AWAITING_APPROVAL";

  return (
    <span
      className={`${styles.statusBadge} ${
        isAwaiting
          ? styles.awaiting
          : styles.approved
      }`}
    >
      {isAwaiting
        ? "Awaiting Approval"
        : "Completed"}
    </span>
  );
}

/* =========================================================
   DETAILS MODAL
========================================================= */

function HistoryDetails({
  item,
  onClose,
}: {
  item: HistoryItem;
  onClose: () => void;
}) {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.detailsModal}>

        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <div>
            <p className={styles.modalLabel}>
              CLEANING RECORD
            </p>

            <h2>Room {item.room}</h2>

            <p className={styles.modalSubtitle}>
              {item.type}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close"
          >
            Ã—
          </button>
        </div>

        {/* Current Status */}
        <section className={styles.detailSection}>
          <div className={styles.sectionTitle}>
            <h3>Current Status</h3>

            <StatusBadge status={item.status} />
          </div>
        </section>

        {/* Cleaning Details */}
        <section className={styles.detailSection}>
          <div className={styles.sectionTitle}>
            <h3>Cleaning Details</h3>
          </div>

          <div className={styles.detailList}>
            <DetailRow
              label="Housekeeper"
              value={item.housekeeper}
            />

            <DetailRow
              label="Started"
              value={formatDateTime(
                item.startedAt
              )}
            />

            <DetailRow
              label="Completed"
              value={formatDateTime(
                item.completedAt
              )}
            />

            <DetailRow
              label="Duration"
              value={item.duration}
            />

            <DetailRow
              label="Photos"
              value={`${item.photos} submitted`}
            />
          </div>
        </section>

        {/* Review History */}
        <section
          className={styles.inspectionSection}
        >
          <div className={styles.inspectionHeader}>
            <div>
              <p className={styles.modalLabel}>
                INSPECTION
              </p>

              <h3>Review History</h3>
            </div>

            <span>
              {item.reviewHistory.length}{" "}
              {item.reviewHistory.length === 1
                ? "review"
                : "reviews"}
            </span>
          </div>

          {item.reviewHistory.length === 0 ? (
            <div className={styles.noReview}>
              No inspection has been recorded yet.
            </div>
          ) : (
            <div className={styles.reviewTimeline}>
              {item.reviewHistory.map(
                (review, index) => (
                  <div
                    key={`${review.reviewedAt}-${index}`}
                    className={styles.reviewEvent}
                  >
                    <div
                      className={`${styles.reviewMarker} ${styles.reviewMarkerApproved}`}
                    />

                    <div
                      className={
                        styles.reviewContent
                      }
                    >
                      <div
                        className={
                          styles.reviewEventHeader
                        }
                      >
                        <div>
                          <strong>
                            Approved
                          </strong>

                          <span>
                            {review.reviewedBy}
                          </span>
                        </div>

                        <small>
                          {formatDateTime(
                            review.reviewedAt
                          )}
                        </small>
                      </div>

                      {review.reviewNote && (
                        <div
                          className={styles.comment}
                        >
                          <strong>
                            Review Note
                          </strong>

                          <p>
                            {review.reviewNote}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        {/* Notes */}
        {item.notes && (
          <section className={styles.notesSection}>
            <p className={styles.modalLabel}>
              HOUSEKEEPING NOTES
            </p>

            <p>{item.notes}</p>
          </section>
        )}

        {/* Photos */}
        <section className={styles.photosSection}>
          <div className={styles.sectionTitle}>
            <h3>Cleaning Photos</h3>

            <span>{item.photos}</span>
          </div>

          {item.photos === 0 ? (
            <div className={styles.noPhotos}>
              No photos submitted.
            </div>
          ) : (
            <div className={styles.photoGrid}>
              {Array.from({
                length: item.photos,
              }).map((_, index) => (
                <div
                  key={index}
                  className={
                    styles.photoPlaceholder
                  }
                >
                  Photo {index + 1}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className={styles.closeModalButton}
        >
          Close
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   DETAIL ROW
========================================================= */

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={styles.detailRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/* =========================================================
   HELPERS
========================================================= */

function getApprovedReviews(
  task: any
): ReviewEvent[] {
  if (Array.isArray(task.reviewHistory)) {
    return task.reviewHistory.filter(
      (review: any) =>
        review.action === "APPROVED"
    );
  }

  if (task.review?.approved) {
    return [
      {
        action: "APPROVED",
        reviewedBy:
          task.review.reviewedBy ?? "â€”",
        reviewedAt:
          task.review.reviewedAt ?? "",
        reviewNote:
          task.review.reviewNote ?? "",
      },
    ];
  }

  return [];
}

/* =========================================================
   DURATION
========================================================= */

function calculateDuration(
  startedAt?: string,
  completedAt?: string
): string {
  if (!startedAt || !completedAt) {
    return "â€”";
  }

  const start =
    new Date(startedAt).getTime();

  const end =
    new Date(completedAt).getTime();

  if (
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    end < start
  ) {
    return "â€”";
  }

  const minutes = Math.round(
    (end - start) / 60000
  );

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  const remainingMinutes =
    minutes % 60;

  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}

/* =========================================================
   FORMAT TIME
========================================================= */

function formatTime(
  value?: string
): string {
  if (!value) {
    return "â€”";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "â€”";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* =========================================================
   FORMAT DATE + TIME
========================================================= */

function formatDateTime(
  value?: string
): string {
  if (!value) {
    return "â€”";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "â€”";
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/* =========================================================
   SAME DAY
========================================================= */

function isSameDay(
  date1: Date,
  date2: Date
): boolean {
  return (
    date1.getFullYear() ===
      date2.getFullYear() &&
    date1.getMonth() ===
      date2.getMonth() &&
    date1.getDate() ===
      date2.getDate()
  );
}

/* =========================================================
   GROUP HISTORY BY DATE
========================================================= */

function groupHistoryByDate(
  history: HistoryItem[]
): Record<string, HistoryItem[]> {
  const groups: Record<
    string,
    HistoryItem[]
  > = {};

  const today = new Date();

  const yesterday = new Date(today);

  yesterday.setDate(
    today.getDate() - 1
  );

  history.forEach((item) => {
    if (!item.completedAt) {
      addToGroup(
        groups,
        "Date unavailable",
        item
      );

      return;
    }

    const date = new Date(
      item.completedAt
    );

    if (
      Number.isNaN(date.getTime())
    ) {
      addToGroup(
        groups,
        "Date unavailable",
        item
      );

      return;
    }

    const formattedDate =
      date.toLocaleDateString([], {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

    let label: string;

    if (isSameDay(date, today)) {
      label = `Today Â· ${formattedDate}`;
    } else if (
      isSameDay(date, yesterday)
    ) {
      label = `Yesterday Â· ${formattedDate}`;
    } else {
      label = formattedDate;
    }

    addToGroup(
      groups,
      label,
      item
    );
  });

  return groups;
}

/* =========================================================
   ADD TO DATE GROUP
========================================================= */

function addToGroup(
  groups: Record<string, HistoryItem[]>,
  label: string,
  item: HistoryItem
) {
  if (!groups[label]) {
    groups[label] = [];
  }

  groups[label].push(item);
}

export default HousekeepingHistoryPage;

