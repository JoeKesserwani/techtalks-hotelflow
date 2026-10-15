"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  todayInHotel,
  type Reservation,
  type Room,
} from "../../app/Pages/Reservations/frontdesk";
import { NewReservationDialog } from "../Reservations/newReservationDialog";
import { RoomAvailabilityChart } from "../Reservations/RoomAvailabilityChart";

export function DashboardRoomAvailability({
  onReservationCreated,
}: {
  onReservationCreated: () => void;
}) {
  const router = useRouter();
  const [today] = useState(todayInHotel);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadAvailability = useCallback(async () => {
    try {
      const [roomsResponse, reservationsResponse] = await Promise.all([
        fetch("/api/v1/rooms", { cache: "no-store" }),
        fetch("/api/v1/reservations", { cache: "no-store" }),
      ]);

      if (!roomsResponse.ok || !reservationsResponse.ok) {
        throw new Error("Failed to load room availability.");
      }

      const [roomData, reservationData] = await Promise.all([
        roomsResponse.json(),
        reservationsResponse.json(),
      ]);
      setRooms(roomData);
      setReservations(reservationData);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load room availability.",
      );
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadAvailability);
  }, [loadAvailability]);

  return (
    <>
      {error && <p role="alert">{error}</p>}
      <RoomAvailabilityChart
        rooms={rooms}
        reservations={reservations}
        date={today}
        today={today}
        onSelectRoom={setSelectedRoomId}
        onViewAll={() => router.push("/Pages/Rooms")}
      />
      {selectedRoomId && (
        <NewReservationDialog
          defaultDate={today}
          today={today}
          rooms={rooms}
          reservations={reservations}
          initialRoomId={selectedRoomId}
          onClose={() => setSelectedRoomId(null)}
          onCreated={(reservation) => {
            setReservations((current) => [...current, reservation]);
            setSelectedRoomId(null);
            onReservationCreated();
            void loadAvailability();
          }}
          onConflict={() => void loadAvailability()}
        />
      )}
    </>
  );
}
