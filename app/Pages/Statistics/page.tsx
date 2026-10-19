"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/Auth/AuthProvider";
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import styles from "./page.module.css";

type DailyStatistic = {
  date: string;
  reservations: number;
  reservationValue: number;
  paidReservationValue: number;
  scheduledOccupancy: number;
  housekeepingCompleted: number;
};

type StatisticsResponse = {
  range: { startDate: string; endDate: string };
  overview: {
    totalRooms: number;
    occupiedRooms: number;
    currentOccupancy: number;
    availableRooms: number;
    reservations: number;
    totalReservationValue: number;
    paidReservationValue: number;
    housekeepingCreated: number;
    housekeepingCompleted: number;
    housekeepingCompletionRate: number;
  };
  roomStatusCounts: Record<string, number>;
  reservationStatuses: Record<string, number>;
  housekeepingStatuses: Record<string, number>;
  daily: DailyStatistic[];
};

const ROOM_COLORS: Record<string, string> = {
  AVAILABLE: "#4f8068",
  OCCUPIED: "#c96b3c",
  RESERVED: "#8b7bb5",
  IN_REVIEW: "#d4a64a",
  NEEDS_CLEANING: "#bd6a5c",
  CLEANING: "#7398ae",
  OUT_OF_SERVICE: "#777777",
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);

const formatAmount = (value: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });

const getDefaultDates = () => {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);

  const toInputDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return {
    startDate: toInputDate(start),
    endDate: toInputDate(end),
  };
};

export default function StatisticsPage() {
  const { user, loading: authLoading } = useAuth();
  const [dates, setDates] = useState(getDefaultDates);
  const [appliedDates, setAppliedDates] = useState(getDefaultDates);
  const [statistics, setStatistics] = useState<StatisticsResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadStatistics = useCallback(async () => {
    if (!user || !["ADMIN", "MANAGER"].includes(user.role)) return;

    setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams({
        startDate: appliedDates.startDate,
        endDate: appliedDates.endDate,
      });

      const response = await fetch(
        `/api/v1/statistics?${query.toString()}`,
        { credentials: "include", cache: "no-store" },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Unable to load statistics.",
        );
      }

      setStatistics(result as StatisticsResponse);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading statistics.",
      );
    } finally {
      setLoading(false);
    }
  }, [user, appliedDates]);

  useEffect(() => {
    if (!authLoading && user) {
      void loadStatistics();
    }
  }, [authLoading, user, loadStatistics]);

  if (authLoading) {
    return <div className={styles.state}>Loading statistics...</div>;
  }

  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return (
      <div className={styles.state}>
        <h1>Access restricted</h1>
        <p>Statistics are available to Admin and Manager accounts.</p>
      </div>
    );
  }

  const overview = statistics?.overview;

  const roomChartData = Object.entries(
    statistics?.roomStatusCounts ?? {},
  ).map(([status, count]) => ({
    name: status.replaceAll("_", " "),
    status,
    count,
  }));

  const reservationStatusData = Object.entries(
    statistics?.reservationStatuses ?? {},
  ).map(([status, count]) => ({
    name: status.replaceAll("_", " "),
    count,
  }));

  const housekeepingStatusData = Object.entries(
    statistics?.housekeepingStatuses ?? {},
  ).map(([status, count]) => ({
    name: status.replaceAll("_", " "),
    count,
  }));

  const handleApplyDates = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (dates.startDate > dates.endDate) {
      setError("Start date must be before or equal to end date.");
      return;
    }

    const days =
      (new Date(`${dates.endDate}T00:00:00Z`).getTime() -
        new Date(`${dates.startDate}T00:00:00Z`).getTime()) /
        86400000 +
      1;

    if (days > 366) {
      setError("Please select a date range of 366 days or less.");
      return;
    }

    setAppliedDates({ ...dates });
  };

  return (
    <div className={styles.page}>
      <main className={styles.content}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>HOTEL PERFORMANCE</p>
            <h1>Statistics</h1>
            <p className={styles.subtitle}>
              Track occupancy, reservations, reservation value, and
              housekeeping performance.
            </p>
          </div>

          <button
            className={styles.refreshButton}
            onClick={() => void loadStatistics()}
            disabled={loading}
            type="button"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </header>

        <form className={styles.filters} onSubmit={handleApplyDates}>
          <div className={styles.dateField}>
            <label htmlFor="startDate">Start date</label>
            <input
              id="startDate"
              type="date"
              required
              value={dates.startDate}
              max={dates.endDate}
              onChange={(event) =>
                setDates((previous) => ({
                  ...previous,
                  startDate: event.target.value,
                }))
              }
            />
          </div>

          <div className={styles.dateField}>
            <label htmlFor="endDate">End date</label>
            <input
              id="endDate"
              type="date"
              required
              value={dates.endDate}
              min={dates.startDate}
              onChange={(event) =>
                setDates((previous) => ({
                  ...previous,
                  endDate: event.target.value,
                }))
              }
            />
          </div>

          <button className={styles.applyButton} type="submit">
            Apply filters
          </button>

          <button
            className={styles.resetButton}
            type="button"
            onClick={() => {
              const defaults = getDefaultDates();
              setDates(defaults);
              setAppliedDates(defaults);
              setError("");
            }}
          >
            Last 30 days
          </button>
        </form>

        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        {loading && !statistics ? (
          <div className={styles.state}>Loading hotel statistics...</div>
        ) : !statistics && error ? (
          <div className={styles.emptyState}>
            <h2>Statistics could not be loaded</h2>
            <p>Check your connection and try refreshing the page.</p>
            <button
              className={styles.applyButton}
              onClick={() => void loadStatistics()}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : statistics && overview ? (
          <>
            <p className={styles.rangeText}>
              Showing {formatDate(statistics.range.startDate)} –{" "}
              {formatDate(statistics.range.endDate)}
              {loading ? " · Updating..." : ""}
            </p>

            <section className={styles.metrics}>
              <MetricCard
                label="Current occupancy"
                value={`${overview.currentOccupancy}%`}
                detail={`${overview.occupiedRooms} of ${overview.totalRooms} rooms occupied`}
                accent="#c96b3c"
              />
              <MetricCard
                label="Reservations"
                value={formatNumber(overview.reservations)}
                detail="Created during selected period"
                accent="#7398ae"
              />
              <MetricCard
                label="Reservation value"
                value={formatAmount(overview.totalReservationValue)}
                detail={`Paid reservation value: ${formatAmount(overview.paidReservationValue)}`}
                accent="#4f8068"
              />
              <MetricCard
                label="Available rooms"
                value={formatNumber(overview.availableRooms)}
                detail={`${overview.totalRooms} rooms in inventory`}
                accent="#8b7bb5"
              />
              <MetricCard
                label="Housekeeping completion"
                value={`${overview.housekeepingCompletionRate}%`}
                detail={`${overview.housekeepingCreated} tasks created in period`}
                accent="#bd6a5c"
              />
              <MetricCard
                label="Tasks completed"
                value={formatNumber(overview.housekeepingCompleted)}
                detail="Completed during selected period"
                accent="#4f8068"
              />
            </section>

            <section className={styles.chartGrid}>
              <ChartCard
                title="Reservation trends"
                description="Reservations created each day"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={statistics.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5ded2" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      minTickGap={24}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      labelFormatter={(label) => formatDate(String(label))}
                    />
                    <Line
                      type="monotone"
                      dataKey="reservations"
                      name="Reservations"
                      stroke="#c96b3c"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Reservation value"
                description="Total and fully paid reservation values"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statistics.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5ded2" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      minTickGap={24}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(label) => formatDate(String(label))}
                      formatter={(value) => formatAmount(Number(value))}
                    />
                    <Legend />
                    <Bar
                      dataKey="reservationValue"
                      name="Reservation value"
                      fill="#c96b3c"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="paidReservationValue"
                      name="Paid reservation value"
                      fill="#4f8068"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Scheduled occupancy"
                description="Rooms with non-cancelled reservations overlapping each day"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={statistics.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5ded2" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      minTickGap={24}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis domain={[0, 100]} unit="%" />
                    <Tooltip
                      labelFormatter={(label) => formatDate(String(label))}
                      formatter={(value) => `${Number(value)}%`}
                    />
                    <Line
                      type="monotone"
                      dataKey="scheduledOccupancy"
                      name="Scheduled occupancy"
                      stroke="#7398ae"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Housekeeping activity"
                description="Tasks completed each day"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statistics.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5ded2" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      minTickGap={24}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      labelFormatter={(label) => formatDate(String(label))}
                    />
                    <Bar
                      dataKey="housekeepingCompleted"
                      name="Tasks completed"
                      fill="#4f8068"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </section>

            <section className={styles.breakdownGrid}>
              <div className={styles.panel}>
                <h2>Room availability</h2>
                <p className={styles.panelDescription}>
                  Current room status across the hotel
                </p>

                {roomChartData.length ? (
                  <>
                    <div className={styles.pieChart}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={roomChartData}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={3}
                          >
                            {roomChartData.map((entry) => (
                              <Cell
                                key={entry.status}
                                fill={
                                  ROOM_COLORS[entry.status] ?? "#999999"
                                }
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className={styles.legendList}>
                      {roomChartData.map((item) => (
                        <div className={styles.legendRow} key={item.status}>
                          <span className={styles.legendLabel}>
                            <span
                              className={styles.legendDot}
                              style={{
                                backgroundColor:
                                  ROOM_COLORS[item.status] ?? "#999999",
                              }}
                            />
                            {item.name}
                          </span>
                          <strong>{item.count}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className={styles.noData}>No room data available.</p>
                )}
              </div>

              <div className={styles.panel}>
                <h2>Reservation statuses</h2>
                <p className={styles.panelDescription}>
                  Reservations created in the selected period
                </p>
                <StatusList data={reservationStatusData} />
              </div>

              <div className={styles.panel}>
                <h2>Housekeeping statuses</h2>
                <p className={styles.panelDescription}>
                  Tasks created in the selected period
                </p>
                <StatusList data={housekeepingStatusData} />
              </div>
            </section>

            <footer className={styles.footerNote}>
              Reservation values are based on stored reservation totals.
              Paid reservation value reflects the current payment status;
              it is not a payment transaction report. Occupancy trends show
              scheduled reservations, while current occupancy uses live room
              statuses.
            </footer>
          </>
        ) : null}
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent: string;
}) {
  return (
    <article className={styles.metricCard}>
      <span
        className={styles.metricAccent}
        style={{ backgroundColor: accent }}
      />
      <p className={styles.metricLabel}>{label}</p>
      <p className={styles.metricValue}>{value}</p>
      <p className={styles.metricDetail}>{detail}</p>
    </article>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <article className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className={styles.chartBody}>{children}</div>
    </article>
  );
}

function StatusList({
  data,
}: {
  data: { name: string; count: number }[];
}) {
  if (!data.length) {
    return <p className={styles.noData}>No data available for this period.</p>;
  }

  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className={styles.statusList}>
      {data.map((item) => {
        const percentage = total
          ? Math.round((item.count / total) * 100)
          : 0;

        return (
          <div className={styles.statusItem} key={item.name}>
            <div className={styles.statusTop}>
              <span>{item.name}</span>
              <strong>{item.count}</strong>
            </div>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <p className={styles.statusPercentage}>{percentage}%</p>
          </div>
        );
      })}
    </div>
  );
}
