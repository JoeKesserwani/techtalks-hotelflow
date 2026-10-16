"use client";

import { useMemo } from "react";
import {
  bucketDay,
  formatDate,
  roomBoard,
  type Reservation,
  type Room,
  type TileState,
} from "../../app/Pages/Reservations/frontdesk";
import styles from "./RoomAvailabilityChart.module.css";

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
  const day = useMemo(
    () => bucketDay(reservations, date, today),
    [reservations, date, today],
  );
  const board = useMemo(
    () => roomBoard(rooms, day, date, today),
    [rooms, day, date, today],
  );
  const floorGroups = useMemo(() => {
    const groups = new Map<number | undefined, typeof board>();
    board.forEach((tile) => {
      const floor = tile.room.floor;
      const group = groups.get(floor);
      if (group) group.push(tile);
      else groups.set(floor, [tile]);
    });
    return [...groups.entries()].sort(([floorA], [floorB]) => {
      if (floorA === undefined) return 1;
      if (floorB === undefined) return -1;
      return floorA - floorB;
    });
  }, [board]);
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
  const bookingDate = date < today ? today : date;

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

      {floorGroups.length ? (
        floorGroups.map(([floor, tiles]) => (
          <section
            className={styles.floorSection}
            key={floor ?? "unassigned"}
            aria-label={
              floor === undefined ? "Floor not set" : `Floor ${floor}`
            }
          >
            <h3 className={styles.floorHeading}>
              {floor === undefined ? "Floor not set" : `Floor ${floor}`}
            </h3>
            <ul className={styles.tiles}>
              {tiles.map(({ room, state, guest }) => (
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
                            STATUS_INFO.find((item) => item.state === state)
                              ?.label)
                          : STATUS_INFO.find((item) => item.state === state)
                              ?.label)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <p className={styles.emptyState}>No rooms to display</p>
      )}
    </section>
  );
}
