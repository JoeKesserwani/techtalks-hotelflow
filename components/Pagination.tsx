"use client";

import styles from "./Pagination.module.css";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
  /** Shows a small "Filtered results" pill next to the count when true. */
  isFiltered?: boolean;
  filteredLabel?: string;
};

/**
 * Builds a compact pagination list such as:
 *   [1] [2] [3] ... [9] [10]
 * or:
 *   [1] ... [5] [6] [7] ... [20]
 */
function getPaginationItems(
  currentPage: number,
  totalPages: number,
): (number | "ellipsis-left" | "ellipsis-right")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis-right", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      "ellipsis-left",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "ellipsis-left",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis-right",
    totalPages,
  ];
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  isFiltered = false,
  filteredLabel = "Filtered results",
}: PaginationProps) {
  if (totalItems === 0) return null;

  const rangeStart = (currentPage - 1) * itemsPerPage + 1;
  const rangeEnd = Math.min(currentPage * itemsPerPage, totalItems);
  const paginationItems = getPaginationItems(currentPage, totalPages);

  function goToPage(page: number) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    onPageChange(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className={styles.pagination}>
      <div className={styles.paginationInfo}>
        <span>
          Showing <strong>{rangeStart}</strong>
          {"–"}
          <strong>{rangeEnd}</strong> of <strong>{totalItems}</strong>
        </span>

        {isFiltered && (
          <span className={styles.searchResultLabel}>{filteredLabel}</span>
        )}
      </div>

      {totalPages > 1 && (
        <nav className={styles.paginationControls} aria-label="Pagination">
          <button
            type="button"
            className={styles.paginationArrow}
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <div className={styles.pageNumbers}>
            {paginationItems.map((item) => {
              if (item === "ellipsis-left" || item === "ellipsis-right") {
                return (
                  <span
                    key={item}
                    className={styles.paginationEllipsis}
                    aria-hidden="true"
                  >
                    ···
                  </span>
                );
              }

              const isActive = item === currentPage;

              return (
                <button
                  key={item}
                  type="button"
                  className={`${styles.pageButton} ${isActive ? styles.pageButtonActive : ""}`}
                  onClick={() => goToPage(item)}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className={styles.paginationArrow}
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M9 18L15 12L9 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </nav>
      )}
    </div>
  );
}
