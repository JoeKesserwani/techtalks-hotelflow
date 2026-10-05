"use client";

import { useEffect, useMemo, useState } from "react";
import Pagination from "../../../components/Pagination";
import { describeActivity, type ActivityLogItem } from "./describeActivity";
import styles from "./page.module.css";
import Header from "@/components/Header/Header";

const PAGE_SIZE = 4;

const CATEGORY_OPTIONS = [
  { value: "", label: "All activity" },
  { value: "reservation", label: "Reservations" },
  { value: "guest", label: "Guests" },
  { value: "room", label: "Rooms" },
  { value: "housekeeping_task", label: "Housekeeping" },
  { value: "user", label: "Staff accounts" },
];

const RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

const AVATAR_CLASSES = [
  "avatarPrimary",
  "avatarAccent",
  "avatarOlive",
] as const;

/** Start of the selected range, as an ISO string the API understands. */
function rangeToFrom(range: string): string | undefined {
  const daysBack =
    range === "today" ? 0 : range === "7d" ? 6 : range === "30d" ? 29 : null;
  if (daysBack === null) return undefined;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - daysBack);
  return start.toISOString();
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dayKey(iso) === dayKey(today.toISOString())) return "Today";
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Yesterday";

  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fullTimestamp(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "full",
    timeStyle: "medium",
  });
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function avatarClass(name: string) {
  const sum = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);
  return AVATAR_CLASSES[sum % AVATAR_CLASSES.length];
}

function roleLabel(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

type Row =
  | { type: "day"; key: string; label: string }
  | { type: "log"; item: ActivityLogItem };

export default function ActivityLogPage() {
  const [items, setItems] = useState<ActivityLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [range, setRange] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Debounce the staff-name search so we don't hit the API on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });
        if (category) params.set("entityType", category);
        if (search) params.set("search", search);
        const from = rangeToFrom(range);
        if (from) params.set("from", from);

        const res = await fetch(`/api/v1/audit-logs?${params}`, {
          signal: controller.signal,
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Could not load the activity log.");
          return;
        }

        setItems(data.items);
        setTotal(data.total);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError("Something went wrong loading the activity log.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [page, category, search, range, reloadKey]);

  const isFiltered = Boolean(category || search || range !== "all");
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Insert a "Today / Yesterday / date" divider whenever the day changes.
  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [];
    let lastKey = "";

    for (const item of items) {
      const key = dayKey(item.createdAt);
      if (key !== lastKey) {
        result.push({ type: "day", key, label: dayLabel(item.createdAt) });
        lastKey = key;
      }
      result.push({ type: "log", item });
    }
    return result;
  }, [items]);

  function resetFilters() {
    setCategory("");
    setRange("all");
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  const showInitialLoading = isLoading && items.length === 0;

  return (
    <main className={styles.page}>
      {Header({
        title: "Activity Log",
        subtitle: "A read-only record of system changes",
        userSubtitle: "Currently reviewing activity",
      })}
      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Search by staff member's name"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Search by staff member's name"
        />

        <select
          className={styles.select}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by category"
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          className={styles.select}
          value={range}
          onChange={(e) => {
            setRange(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by date range"
        >
          {RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {isFiltered && (
          <button
            type="button"
            className={styles.resetButton}
            onClick={resetFilters}
          >
            Clear filters
          </button>
        )}
      </div>

      <p className={styles.legend}>
        <span className={styles.legendBar} aria-hidden="true" />
        Rows with an orange bar are worth a look: cancellations, no-shows, rooms
        taken out of service, and staff account changes.
      </p>

      <section className={styles.tableCard}>
        {error ? (
          <div className={styles.stateBox} role="alert">
            <p>{error}</p>
            <button
              type="button"
              className={styles.retryButton}
              onClick={() => setReloadKey((k) => k + 1)}
            >
              Try again
            </button>
          </div>
        ) : showInitialLoading ? (
          <div className={styles.stateBox}>Loading activity…</div>
        ) : items.length === 0 ? (
          <div className={styles.stateBox}>
            {isFiltered
              ? "No activity matches these filters."
              : "No activity has been recorded yet."}
          </div>
        ) : (
          <div className={styles.tableScroll}>
            <table
              className={`${styles.table} ${isLoading ? styles.tableRefreshing : ""}`}
            >
              <thead>
                <tr>
                  <th scope="col" className={styles.timeCol}>
                    Time
                  </th>
                  <th scope="col" className={styles.staffCol}>
                    Staff member
                  </th>
                  <th scope="col">What happened</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => {
                  if (row.type === "day") {
                    return (
                      <tr key={`day-${row.key}`} className={styles.dayRow}>
                        <th scope="colgroup" colSpan={3}>
                          {row.label}
                        </th>
                      </tr>
                    );
                  }

                  const { item } = row;
                  const info = describeActivity(item);
                  const staffName = item.user?.fullName ?? "Unknown user";

                  return (
                    <tr
                      key={item.id}
                      className={info.notable ? styles.rowNotable : undefined}
                    >
                      <td
                        className={styles.timeCell}
                        title={fullTimestamp(item.createdAt)}
                      >
                        {timeLabel(item.createdAt)}
                      </td>

                      <td>
                        <div className={styles.staff}>
                          <span
                            className={`${styles.avatar} ${styles[avatarClass(staffName)]}`}
                          >
                            {initials(staffName)}
                          </span>
                          <div>
                            <div className={styles.staffName}>{staffName}</div>
                            {item.user && (
                              <div className={styles.staffRole}>
                                {roleLabel(item.user.role)}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className={styles.activity}>
                          <span
                            className={`${styles.tag} ${styles[`tag_${info.category}`]}`}
                          >
                            {info.categoryLabel}
                          </span>
                          <div>
                            <div className={styles.summary}>{info.summary}</div>
                            {info.detail && (
                              <div className={styles.detail}>{info.detail}</div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!error && total > 0 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={total}
            itemsPerPage={PAGE_SIZE}
            isFiltered={isFiltered}
          />
        )}
      </section>
    </main>
  );
}
