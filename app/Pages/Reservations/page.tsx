"use client";

import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Navbars/navbar";
import styles from "./page.module.css";

type Guest = {
  id: string;
  fullName: string;
  phone?: string | null;
};

type Room = {
  id: string;
  hotelId: string;
  roomNumber: string;
  roomType: string;
  basePrice: string | number;
};

type Hotel = {
  id: string;
  name: string;
};

type User = {
  id: string;
  fullName: string;
  role: string;
};

type Reservation = {
  id: string;
  hotelId: string;
  roomId: string;
  guestId: string;
  createdByUserId: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  pricePerNight: string | number;
  totalPrice: string | number;
  paymentStatus: string;
  guest: Guest;
  room: Room;
};

const Page = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState("month");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editingReservation, setEditingReservation] =
    useState<Reservation | null>(null);

  const [error, setError] = useState("");

  const [form, setForm] = useState({
    hotelId: "",
    guestId: "",
    roomId: "",
    createdByUserId: "",
    checkInDate: "",
    checkOutDate: "",
    pricePerNight: "",
    totalPrice: "",
    status: "BOOKED",
    paymentStatus: "UNPAID",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [
        reservationsResponse,
        guestsResponse,
        roomsResponse,
        hotelsResponse,
        usersResponse,
      ] = await Promise.all([
        fetch("/api/reservations"),
        fetch("/api/guests"),
        fetch("/api/rooms"),
        fetch("/api/hotels"),
        fetch("/api/users"),
      ]);

      if (
        !reservationsResponse.ok ||
        !guestsResponse.ok ||
        !roomsResponse.ok ||
        !hotelsResponse.ok ||
        !usersResponse.ok
      ) {
        throw new Error("Failed to load data");
      }

      const reservationsData = await reservationsResponse.json();
      const guestsData = await guestsResponse.json();
      const roomsData = await roomsResponse.json();
      const hotelsData = await hotelsResponse.json();
      const usersData = await usersResponse.json();

      setReservations(reservationsData);
      setGuests(guestsData);
      setRooms(roomsData);
      setHotels(hotelsData);
      setUsers(usersData);
    } catch (err) {
      console.error(err);
      setError("Failed to load reservation data.");
    }
  }

  function openNewReservation() {
    setEditingReservation(null);
    setError("");

    setForm({
      hotelId: hotels[0]?.id || "",
      guestId: guests[0]?.id || "",
      roomId: rooms[0]?.id || "",
      createdByUserId:
        users.find((user) => user.role === "RECEPTIONIST")?.id ||
        users[0]?.id ||
        "",
      checkInDate: "",
      checkOutDate: "",
      pricePerNight: rooms[0]?.basePrice?.toString() || "",
      totalPrice: "",
      status: "BOOKED",
      paymentStatus: "UNPAID",
    });

    setShowModal(true);
  }

  function openEditReservation(reservation: Reservation) {
    setEditingReservation(reservation);
    setError("");

    setForm({
      hotelId: reservation.hotelId,
      guestId: reservation.guestId,
      roomId: reservation.roomId,
      createdByUserId: reservation.createdByUserId,
      checkInDate: reservation.checkInDate.slice(0, 10),
      checkOutDate: reservation.checkOutDate.slice(0, 10),
      pricePerNight: String(reservation.pricePerNight),
      totalPrice: String(reservation.totalPrice),
      status: reservation.status,
      paymentStatus: reservation.paymentStatus,
    });

    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingReservation(null);
    setError("");
  }

  function handleRoomChange(roomId: string) {
    const selectedRoom = rooms.find((room) => room.id === roomId);

    const price = selectedRoom
      ? Number(selectedRoom.basePrice)
      : 0;

    setForm((previous) => ({
      ...previous,
      roomId,
      pricePerNight: price.toString(),
    }));
  }

  function calculateTotal(
    checkInDate: string,
    checkOutDate: string,
    pricePerNight: string
  ) {
    if (!checkInDate || !checkOutDate || !pricePerNight) {
      return "";
    }

    const checkIn = new Date(`${checkInDate}T00:00:00`);
    const checkOut = new Date(`${checkOutDate}T00:00:00`);

    const difference = checkOut.getTime() - checkIn.getTime();

    const nights = difference / (1000 * 60 * 60 * 24);

    if (nights <= 0) {
      return "";
    }

    return (nights * Number(pricePerNight)).toFixed(2);
  }

  function handleDateChange(
    field: "checkInDate" | "checkOutDate",
    value: string
  ) {
    const updatedForm = {
      ...form,
      [field]: value,
    };

    const total = calculateTotal(
      updatedForm.checkInDate,
      updatedForm.checkOutDate,
      updatedForm.pricePerNight
    );

    setForm({
      ...updatedForm,
      totalPrice: total,
    });
  }

  async function saveReservation(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!form.hotelId || !form.guestId || !form.roomId) {
      setError("Please select a hotel, guest, and room.");
      return;
    }

    if (!form.checkInDate || !form.checkOutDate) {
      setError("Please select check-in and check-out dates.");
      return;
    }

    if (!form.pricePerNight || !form.totalPrice) {
      setError("Price information is required.");
      return;
    }

    if (!form.createdByUserId) {
      setError("No user is available to create this reservation.");
      return;
    }

    try {
      const url = "/api/reservations";

      const method = editingReservation ? "PATCH" : "POST";

      const body = editingReservation
        ? {
            id: editingReservation.id,
            checkInDate: form.checkInDate,
            checkOutDate: form.checkOutDate,
            status: form.status,
            pricePerNight: Number(form.pricePerNight),
            totalPrice: Number(form.totalPrice),
            paymentStatus: form.paymentStatus,
          }
        : {
            hotelId: form.hotelId,
            roomId: form.roomId,
            guestId: form.guestId,
            createdByUserId: form.createdByUserId,
            checkInDate: form.checkInDate,
            checkOutDate: form.checkOutDate,
            status: form.status,
            pricePerNight: Number(form.pricePerNight),
            totalPrice: Number(form.totalPrice),
            paymentStatus: form.paymentStatus,
          };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save reservation");
      }

      closeModal();
      await loadData();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save reservation."
      );
    }
  }

  async function deleteReservation(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this reservation?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch("/api/reservations", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete reservation");
      }

      await loadData();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete reservation."
      );
    }
  }

  const filteredReservations = useMemo(() => {
    const now = new Date();

    return reservations.filter((reservation) => {
      const guestName =
        reservation.guest?.fullName?.toLowerCase() || "";

      const phone =
        reservation.guest?.phone?.toLowerCase() || "";

      const roomNumber =
        reservation.room?.roomNumber?.toLowerCase() || "";

      const reservationId =
        reservation.id.toLowerCase();

      const searchValue = search.toLowerCase();

      const matchesSearch =
        guestName.includes(searchValue) ||
        phone.includes(searchValue) ||
        roomNumber.includes(searchValue) ||
        reservationId.includes(searchValue);

      if (!matchesSearch) {
        return false;
      }

      const reservationDate = new Date(
        reservation.checkInDate
      );

      let matchesTime = true;

      if (timeFilter === "month") {
        matchesTime =
          reservationDate.getMonth() === now.getMonth() &&
          reservationDate.getFullYear() === now.getFullYear();
      }

      if (timeFilter === "week") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);

        matchesTime = reservationDate >= sevenDaysAgo;
      }

      if (statusFilter !== "all") {
        matchesTime =
          matchesTime &&
          reservation.status.toLowerCase() === statusFilter;
      }

      return matchesTime;
    });
  }, [reservations, search, timeFilter, statusFilter]);

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case "BOOKED":
        return "Upcoming";
      case "CHECKED_IN":
        return "In stay";
      case "CHECKED_OUT":
        return "Checked-out";
      case "CANCELLED":
        return "Cancelled";
      case "NO_SHOW":
        return "No-show";
      default:
        return status;
    }
  }

  function getStatusClass(status: string) {
    switch (status) {
      case "BOOKED":
        return styles.upcoming;
      case "CHECKED_IN":
        return styles.inStay;
      case "CHECKED_OUT":
        return styles.checkedOut;
      case "CANCELLED":
        return styles.cancelled;
      default:
        return styles.inStay;
    }
  }

  return (
    <div className={styles.page}>
      <Sidebar />

      <main className={styles.content}>
        <div className={styles.header}>
          <div className={styles.title}>
            <h1>Reservations</h1>

            <p>
              {filteredReservations.length} reservations
            </p>
          </div>

          <div className={styles.userInfo}>
            <strong>Receptionist&apos;s name</strong>

            <span className={styles.userRole}>
              Receptionist
            </span>
          </div>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        <div className={styles.toolbar}>
          <input
            className={styles.search}
            type="text"
            placeholder="Search by guest's name, ID, room number"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          <select
            className={styles.filter}
            value={timeFilter}
            onChange={(event) =>
              setTimeFilter(event.target.value)
            }
          >
            <option value="month">This month</option>
            <option value="week">Last 7 days</option>
            <option value="all">All time</option>
          </select>

          <select
            className={styles.filter}
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="all">All statuses</option>
            <option value="booked">Upcoming</option>
            <option value="checked_in">In stay</option>
            <option value="checked_out">
              Checked-out
            </option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            className={styles.newButton}
            onClick={openNewReservation}
          >
            + New reservation
          </button>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Guest</th>
                <th>Room</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {filteredReservations.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className={styles.empty}
                  >
                    No reservations found.
                  </td>
                </tr>
              ) : (
                filteredReservations.map(
                  (reservation) => (
                    <tr key={reservation.id}>
                      <td>
                        <div className={styles.guest}>
                          <strong>
                            {reservation.guest?.fullName ||
                              "Unknown guest"}
                          </strong>

                          <small>
                            {reservation.guest?.phone ||
                              "No phone"}
                          </small>
                        </div>
                      </td>

                      <td>
                        {reservation.room?.roomNumber ||
                          "-"}
                      </td>

                      <td>
                        {formatDate(
                          reservation.checkInDate
                        )}
                      </td>

                      <td>
                        {formatDate(
                          reservation.checkOutDate
                        )}
                      </td>

                      <td>
                        <span
                          className={`${styles.status} ${getStatusClass(
                            reservation.status
                          )}`}
                        >
                          {getStatusLabel(
                            reservation.status
                          )}
                        </span>
                      </td>

                      <td>
                        <button
                          className={styles.editButton}
                          onClick={() =>
                            openEditReservation(
                              reservation
                            )
                          }
                        >
                          Edit
                        </button>

                        <button
                          className={styles.deleteButton}
                          onClick={() =>
                            deleteReservation(
                              reservation.id
                            )
                          }
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </main>

      {showModal && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>
                {editingReservation
                  ? "Edit reservation"
                  : "New reservation"}
              </h2>

              <button
                className={styles.closeButton}
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            <form onSubmit={saveReservation}>
              <div className={styles.formGrid}>
                <label>
                  Hotel
                  <select
                    value={form.hotelId}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        hotelId: event.target.value,
                      })
                    }
                    disabled={!!editingReservation}
                  >
                    <option value="">
                      Select hotel
                    </option>

                    {hotels.map((hotel) => (
                      <option
                        key={hotel.id}
                        value={hotel.id}
                      >
                        {hotel.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Guest
                  <select
                    value={form.guestId}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        guestId: event.target.value,
                      })
                    }
                    disabled={!!editingReservation}
                  >
                    <option value="">
                      Select guest
                    </option>

                    {guests.map((guest) => (
                      <option
                        key={guest.id}
                        value={guest.id}
                      >
                        {guest.fullName}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Room
                  <select
                    value={form.roomId}
                    onChange={(event) =>
                      handleRoomChange(
                        event.target.value
                      )
                    }
                    disabled={!!editingReservation}
                  >
                    <option value="">
                      Select room
                    </option>

                    {rooms.map((room) => (
                      <option
                        key={room.id}
                        value={room.id}
                      >
                        Room {room.roomNumber} —{" "}
                        {room.roomType}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Created by
                  <select
                    value={form.createdByUserId}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        createdByUserId:
                          event.target.value,
                      })
                    }
                    disabled={!!editingReservation}
                  >
                    <option value="">
                      Select user
                    </option>

                    {users.map((user) => (
                      <option
                        key={user.id}
                        value={user.id}
                      >
                        {user.fullName} — {user.role}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Check-in
                  <input
                    type="date"
                    value={form.checkInDate}
                    onChange={(event) =>
                      handleDateChange(
                        "checkInDate",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label>
                  Check-out
                  <input
                    type="date"
                    value={form.checkOutDate}
                    onChange={(event) =>
                      handleDateChange(
                        "checkOutDate",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label>
                  Price per night
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.pricePerNight}
                    onChange={(event) => {
                      const price =
                        event.target.value;

                      const total = calculateTotal(
                        form.checkInDate,
                        form.checkOutDate,
                        price
                      );

                      setForm({
                        ...form,
                        pricePerNight: price,
                        totalPrice: total,
                      });
                    }}
                  />
                </label>

                <label>
                  Total price
                  <input
                    type="number"
                    value={form.totalPrice}
                    readOnly
                  />
                </label>

                <label>
                  Status
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        status: event.target.value,
                      })
                    }
                  >
                    <option value="BOOKED">
                      Upcoming
                    </option>

                    <option value="CHECKED_IN">
                      In stay
                    </option>

                    <option value="CHECKED_OUT">
                      Checked-out
                    </option>

                    <option value="CANCELLED">
                      Cancelled
                    </option>

                    <option value="NO_SHOW">
                      No-show
                    </option>
                  </select>
                </label>

                <label>
                  Payment
                  <select
                    value={form.paymentStatus}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        paymentStatus:
                          event.target.value,
                      })
                    }
                  >
                    <option value="UNPAID">
                      Unpaid
                    </option>

                    <option value="PARTIAL">
                      Partial
                    </option>

                    <option value="PAID">
                      Paid
                    </option>
                  </select>
                </label>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={closeModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={styles.saveButton}
                >
                  {editingReservation
                    ? "Save changes"
                    : "Create reservation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Page;