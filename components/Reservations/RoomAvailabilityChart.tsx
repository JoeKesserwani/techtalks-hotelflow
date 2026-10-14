"use client";

import { useMemo, useState } from "react";
import {
  bucketDay,
  formatDate,
  roomBoard,
  type Reservation,
  type Room,
  type TileState,
} from "../../app/Pages/Reservations/frontdesk";
import styles from "./RoomAvailabilityChart.module.css";

const PAGE_SIZE = 20;

const STATUS_INFO: { state: TileState; label: string }[] = [
  { state: "free", label: "Free" },
  { state: "arriving", label: "Arriving" },
  { state: "occupied", label: "Occupied" },
  { state: "departing", label: "Leaves today" },
  { state: "needsCleaning", label: "Needs cleaning" },
  { state: "cleaning", label: "Being cleaned" },
  { state: "inReview", label: "Awaiting review" },
  { state: "oos", label: "Out of service" },
];

export interface RoomAvailabilityChartProps {
  rooms: Room[];
  reservations: Reservation[];
  date: string;
  today: string;
  onSelectRoom: (roomId: string) => void;
  onViewAll?: () => void;
}

export function RoomAvailabilityChart({
  rooms,
  reservations,
  date,
  today,
  onSelectRoom,
  onViewAll,
}: RoomAvailabilityChartProps) {
  const [pagination, setPagination] = useState({ date, page: 0 });

  const day = useMemo(
    () => bucketDay(reservations, date, today),
    [reservations, date, today],
  );
  const board = useMemo(
    () => roomBoard(rooms, day, date, today),
    [rooms, day, date, today],
  );

  const pageCount = Math.max(1, Math.ceil(board.length / PAGE_SIZE));
  const selectedPage = pagination.date === date ? pagination.page : 0;
  const page = Math.min(selectedPage, pageCount - 1);
  const visibleTiles = board.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const statusCounts = board.reduce<Record<TileState, number>>(
    (counts, tile) => {
      counts[tile.state] += 1;
      return counts;
    },
    {
      free: 0,
      arriving: 0,
      occupied: 0,
      departing: 0,
      needsCleaning: 0,
      cleaning: 0,
      inReview: 0,
      oos: 0,
    },
  );

  const free = statusCounts.free;
  const tonight = statusCounts.arriving + statusCounts.occupied;
  const occupancy = rooms.length
    ? Math.round((tonight / rooms.length) * 100)
    : 0;
  const firstRoom = board.length ? page * PAGE_SIZE + 1 : 0;
  const lastRoom = Math.min((page + 1) * PAGE_SIZE, board.length);
  const bookingDate = date < today ? today : date;

  const changePage = (nextPage: number) => {
    setPagination({ date, page: nextPage });
  };

  return (
    <section
      className={styles.availability}
      aria-labelledby="room-availability-title"
    >
      <div className={styles.cardHead}>
        <div className={styles.heading}>
          <h2 id="room-availability-title">Room availability</h2>
          <p className={styles.hint}>
            {rooms.length
              ? `${occupancy}% occupied tonight · select a free room to book it for ${formatDate(bookingDate, { month: "short", day: "numeric" })}`
              : "Loading rooms…"}
          </p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.freeBadge}>{free} free</span>
          {onViewAll && (
            <button
              className={styles.viewAll}
              type="button"
              onClick={onViewAll}
            >
              View all
            </button>
          )}
        </div>
      </div>

      <ul className={styles.statusStats} aria-label="Room counts by status">
        {STATUS_INFO.map(({ state, label }) => (
          <li key={state} className={styles.statusStat}>
            <i
              className={`${styles.dot} ${styles[`t_${state}`]}`}
              aria-hidden="true"
            />
            <span>{label}</span>
            <strong>{statusCounts[state]}</strong>
          </li>
        ))}
      </ul>

      <ul className={styles.tiles}>
        {visibleTiles.map(({ room, state, guest }) => (
          <li key={room.id}>
            <button
              className={`${styles.tile} ${styles[`t_${state}`]}`}
              disabled={state !== "free" || date < today}
              onClick={() => onSelectRoom(room.id)}
              aria-label={`Room ${room.roomNumber}, ${STATUS_INFO.find((item) => item.state === state)?.label ?? state}${guest ? `, ${guest}` : ""}`}
            >
              <strong>{room.roomNumber}</strong>
              <span>
                {guest ??
                  (state === "free"
                    ? (room.roomType ??
                      STATUS_INFO.find((item) => item.state === state)?.label)
                    : STATUS_INFO.find((item) => item.state === state)?.label)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <nav className={styles.pagination} aria-label="Room availability pages">
        <span className={styles.range}>
          {board.length
            ? `Showing ${firstRoom}–${lastRoom} of ${board.length} rooms`
            : "No rooms to display"}
        </span>
        <div className={styles.pageControls}>
          <button
            className={styles.pageButton}
            type="button"
            aria-label="Previous rooms"
            disabled={page === 0}
            onClick={() => changePage(page - 1)}
          >
            ‹
          </button>
          <span className={styles.pageLabel}>
            Page {page + 1} of {pageCount}
          </span>
          <button
            className={styles.pageButton}
            type="button"
            aria-label="Next rooms"
            disabled={page >= pageCount - 1}
            onClick={() => changePage(page + 1)}
          >
            ›
          </button>
        </div>
      </nav>
    </section>
  );
}
