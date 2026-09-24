"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Pagination from "@/components/Pagination";
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
  status: string;
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

type FormData = {
  guestId: string;
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  pricePerNight: string;
  totalPrice: string;
  status: string;
  paymentStatus: string;
};

const ITEMS_PER_PAGE = 5;

/*
 * TODAY
 */
const getTodayString = () => {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/*
 * ROOM STATUS LABEL
 */
const getRoomStatusLabel = (status: string) => {
  switch (status) {
    case "AVAILABLE":
      return "Available";

    case "RESERVED":
      return "Reserved";

    case "OCCUPIED":
      return "Occupied";

    case "NEEDS_CLEANING":
      return "Needs cleaning";

    case "CLEANING":
      return "Cleaning";

    case "OUT_OF_SERVICE":
      return "Out of service";

    case "MAINTENANCE":
      return "Maintenance";

    default:
      return status;
  }
};

/*
 * ROOMS THAT CANNOT BE SELECTED
 */
const isRoomCurrentlyUnavailable = (room: Room) => {
  return (
    room.status === "OCCUPIED" ||
    room.status === "CLEANING" ||
    room.status === "NEEDS_CLEANING" ||
    room.status === "OUT_OF_SERVICE" ||
    room.status === "MAINTENANCE"
  );
};

/*
 * CALCULATE NIGHTS
 */
const calculateNights = (checkInDate: string, checkOutDate: string) => {
  if (!checkInDate || !checkOutDate) {
    return 0;
  }

  const checkIn = new Date(`${checkInDate}T00:00:00`);
  const checkOut = new Date(`${checkOutDate}T00:00:00`);

  const difference = checkOut.getTime() - checkIn.getTime();

  const nights = Math.ceil(difference / (1000 * 60 * 60 * 24));

  return nights > 0 ? nights : 0;
};

/*
 * FORMAT DATE
 */
const formatDate = (dateString: string) => {
  if (!dateString) {
    return "-";
  }

  return new Date(dateString).toLocaleDateString();
};

/*
 * FORMAT PRICE
 */
const formatPrice = (value: string | number) => {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return "0.00";
  }

  return number.toFixed(2);
};

/*
 * RESERVATION STATUS LABEL
 */
const getStatusLabel = (status: string) => {
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
};

/*
 * RESERVATION STATUS CSS
 */
const getStatusClass = (status: string) => {
  switch (status) {
    case "BOOKED":
      return styles.upcoming;

    case "CHECKED_IN":
      return styles.inStay;

    case "CHECKED_OUT":
      return styles.checkedOut;

    case "CANCELLED":
    case "NO_SHOW":
      return styles.cancelled;

    default:
      return "";
  }
};

/*
 * SAFELY READ API RESPONSE
 */
const readApiResponse = async (response: Response) => {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    console.error("API returned a non-JSON response:", text);

    throw new Error(`Server returned ${response.status} instead of JSON.`);
  }
};

export default function ReservationsPage() {
  /*
   * DATA
   */
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  /*
   * UI STATE
   */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const [editingReservation, setEditingReservation] =
    useState<Reservation | null>(null);

  /*
   * FORM
   */
  const [form, setForm] = useState<FormData>({
    guestId: "",
    roomId: "",
    checkInDate: "",
    checkOutDate: "",
    pricePerNight: "",
    totalPrice: "",
    status: "BOOKED",
    paymentStatus: "UNPAID",
  });

  const today = getTodayString();

  const searchParams = useSearchParams();
  const presetGuestId = searchParams.get("guestId");
  const hasAutoOpenedRef = useRef(false);

  /*
   * LOAD DATABASE DATA
   */
  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [reservationsResponse, guestsResponse, roomsResponse] =
        await Promise.all([
          fetch("/api/v1/reservations", { credentials: "include" }),
          fetch("/api/v1/guests", { credentials: "include" }),
          fetch("/api/v1/rooms", { credentials: "include" }),
        ]);

      const reservationsData = await readApiResponse(reservationsResponse);
      const guestsData = await readApiResponse(guestsResponse);
      const roomsData = await readApiResponse(roomsResponse);

      if (!reservationsResponse.ok) {
        throw new Error(
          reservationsData?.error ||
            reservationsData?.message ||
            "Failed to load reservations",
        );
      }

      if (!guestsResponse.ok) {
        throw new Error(
          guestsData?.error || guestsData?.message || "Failed to load guests",
        );
      }

      if (!roomsResponse.ok) {
        throw new Error(
          roomsData?.error || roomsData?.message || "Failed to load rooms",
        );
      }

      setReservations(
        Array.isArray(reservationsData)
          ? reservationsData
          : reservationsData?.data || reservationsData?.reservations || [],
      );

      setGuests(
        Array.isArray(guestsData)
          ? guestsData
          : guestsData?.data || guestsData?.guests || [],
      );

      setRooms(
        Array.isArray(roomsData)
          ? roomsData
          : roomsData?.data || roomsData?.rooms || [],
      );
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (hasAutoOpenedRef.current) return;
    if (!presetGuestId || loading) return;

    const matchedGuest = guests.find((guest) => guest.id === presetGuestId);
    if (!matchedGuest) return;

    hasAutoOpenedRef.current = true;
    openNewReservation(presetGuestId);
  }, [presetGuestId, loading, guests]);

  /*
   * SEARCH + FILTER
   */
  const filteredReservations = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return reservations.filter((reservation) => {
      const guestName = reservation.guest?.fullName?.toLowerCase() || "";
      const roomNumber = reservation.room?.roomNumber?.toLowerCase() || "";
      const reservationId = reservation.id.toLowerCase();

      const matchesSearch =
        !searchValue ||
        guestName.includes(searchValue) ||
        roomNumber.includes(searchValue) ||
        reservationId.includes(searchValue);

      if (!matchesSearch) {
        return false;
      }

      if (filter === "all") {
        return true;
      }

      if (filter === "this_month") {
        const reservationDate = new Date(reservation.checkInDate);
        const currentDate = new Date();

        return (
          reservationDate.getMonth() === currentDate.getMonth() &&
          reservationDate.getFullYear() === currentDate.getFullYear()
        );
      }

      if (filter === "upcoming") {
        return reservation.status === "BOOKED";
      }

      if (filter === "in_stay") {
        return reservation.status === "CHECKED_IN";
      }

      if (filter === "checked_out") {
        return reservation.status === "CHECKED_OUT";
      }

      if (filter === "cancelled") {
        return (
          reservation.status === "CANCELLED" || reservation.status === "NO_SHOW"
        );
      }

      return true;
    });
  }, [reservations, search, filter]);

  /*
   * PAGINATION CALCULATIONS
   */
  const totalPages = Math.max(
    1,
    Math.ceil(filteredReservations.length / ITEMS_PER_PAGE),
  );

  const activePage = Math.min(currentPage, totalPages);

  const paginatedReservations = useMemo(() => {
    const start = (activePage - 1) * ITEMS_PER_PAGE;
    return filteredReservations.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredReservations, activePage]);

  /*
   * RESET FORM
   */
  const resetForm = () => {
    setForm({
      guestId: "",
      roomId: "",
      checkInDate: today,
      checkOutDate: "",
      pricePerNight: "",
      totalPrice: "",
      status: "BOOKED",
      paymentStatus: "UNPAID",
    });
  };

  /*
   * NEW RESERVATION
   */
  const openNewReservation = (presetGuestIdArg?: string) => {
    setEditingReservation(null);

    const firstUsableRoom = rooms.find(
      (room) => !isRoomCurrentlyUnavailable(room),
    );

    setForm({
      guestId: presetGuestIdArg || guests[0]?.id || "",
      roomId: firstUsableRoom?.id || "",
      checkInDate: today,
      checkOutDate: "",
      pricePerNight: firstUsableRoom ? String(firstUsableRoom.basePrice) : "",
      totalPrice: "",
      status: "BOOKED",
      paymentStatus: "UNPAID",
    });

    setError("");
    setShowModal(true);
  };

  /*
   * EDIT RESERVATION
   */
  const openEditReservation = (reservation: Reservation) => {
    setEditingReservation(reservation);

    setForm({
      guestId: reservation.guestId,
      roomId: reservation.roomId,
      checkInDate: reservation.checkInDate.split("T")[0],
      checkOutDate: reservation.checkOutDate.split("T")[0],
      pricePerNight: String(
        reservation.room?.basePrice ?? reservation.pricePerNight,
      ),
      totalPrice: String(reservation.totalPrice),
      status: reservation.status,
      paymentStatus:
        reservation.paymentStatus === "PAID"
          ? "PAID"
          : reservation.paymentStatus === "PARTIAL"
            ? "PARTIAL"
            : "UNPAID",
    });

    setError("");
    setShowModal(true);
  };

  /*
   * CLOSE MODAL
   */
  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingReservation(null);
    resetForm();
    setError("");
  };

  /*
   * HANDLERS FOR INPUTS
   */
  const handleGuestChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setForm((current) => ({
      ...current,
      guestId: event.target.value,
    }));
  };

  const handleRoomChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const roomId = event.target.value;
    const selectedRoom = rooms.find((room) => room.id === roomId);

    if (!selectedRoom) {
      setForm((current) => ({
        ...current,
        roomId,
        pricePerNight: "",
        totalPrice: "",
      }));
      return;
    }

    if (isRoomCurrentlyUnavailable(selectedRoom)) {
      setError("This room is currently unavailable.");
      return;
    }

    setError("");
    const nights = calculateNights(form.checkInDate, form.checkOutDate);
    const pricePerNight = Number(selectedRoom.basePrice);
    const totalPrice = nights > 0 ? pricePerNight * nights : 0;

    setForm((current) => ({
      ...current,
      roomId,
      pricePerNight: String(pricePerNight),
      totalPrice: String(totalPrice),
    }));
  };

  const handleCheckInChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checkInDate = event.target.value;

    if (checkInDate < today) {
      setError("Check-in date cannot be before today.");
      return;
    }

    if (form.checkOutDate && form.checkOutDate <= checkInDate) {
      setError("Check-out date must be after check-in date.");
    } else {
      setError("");
    }

    const nights = calculateNights(checkInDate, form.checkOutDate);
    const selectedRoom = rooms.find((room) => room.id === form.roomId);
    const pricePerNight = selectedRoom ? Number(selectedRoom.basePrice) : 0;

    setForm((current) => ({
      ...current,
      checkInDate,
      totalPrice: String(nights > 0 ? pricePerNight * nights : 0),
    }));
  };

  const handleCheckOutChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checkOutDate = event.target.value;

    if (form.checkInDate && checkOutDate <= form.checkInDate) {
      setError("Check-out date must be after check-in date.");
    } else {
      setError("");
    }

    const nights = calculateNights(form.checkInDate, checkOutDate);
    const selectedRoom = rooms.find((room) => room.id === form.roomId);
    const pricePerNight = selectedRoom ? Number(selectedRoom.basePrice) : 0;

    setForm((current) => ({
      ...current,
      checkOutDate,
      totalPrice: String(nights > 0 ? pricePerNight * nights : 0),
    }));
  };

  /*
   * CHECK IN / OUT / DELETE
   */
  const handleCheckIn = async (reservationId: string) => {
    if (!window.confirm("Are you sure you want to check in this guest?"))
      return;

    try {
      setError("");
      const response = await fetch(
        `/api/v1/reservations/${reservationId}/check-in`,
        { method: "POST", credentials: "include" },
      );
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data?.error || data?.message || "Failed to check in reservation",
        );
      }
      await loadData();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to check in reservation",
      );
    }
  };

  const handleCheckOut = async (reservationId: string) => {
    if (!window.confirm("Are you sure you want to check out this guest?"))
      return;

    try {
      setError("");
      const response = await fetch(
        `/api/v1/reservations/${reservationId}/check-out`,
        { method: "POST", credentials: "include" },
      );
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data?.error || data?.message || "Failed to check out reservation",
        );
      }
      await loadData();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to check out reservation",
      );
    }
  };

  const handleDelete = async (reservationId: string) => {
    if (!window.confirm("Are you sure you want to delete this reservation?"))
      return;

    try {
      setError("");
      const response = await fetch(`/api/v1/reservations/${reservationId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data?.error || data?.message || "Failed to delete reservation",
        );
      }
      await loadData();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to delete reservation",
      );
    }
  };

  /*
   * SAVE RESERVATION
   */
  const saveReservation = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!form.guestId) {
      setError("Please select a guest.");
      return;
    }
    if (!form.roomId) {
      setError("Please select a room.");
      return;
    }
    if (!form.checkInDate) {
      setError("Please select a check-in date.");
      return;
    }
    if (!form.checkOutDate) {
      setError("Please select a check-out date.");
      return;
    }

    if (!editingReservation && form.checkInDate < today) {
      setError("Check-in date cannot be before today.");
      return;
    }

    if (form.checkOutDate <= form.checkInDate) {
      setError("Check-out date must be after check-in date.");
      return;
    }

    const selectedRoom = rooms.find((room) => room.id === form.roomId);
    if (!selectedRoom) {
      setError("Selected room was not found.");
      return;
    }

    if (!editingReservation && isRoomCurrentlyUnavailable(selectedRoom)) {
      setError("This room is currently unavailable.");
      return;
    }

    const nights = calculateNights(form.checkInDate, form.checkOutDate);
    if (nights <= 0) {
      setError("Reservation must be at least one night.");
      return;
    }

    try {
      setSaving(true);

      if (editingReservation) {
        const response = await fetch(
          `/api/v1/reservations/${editingReservation.id}`,
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              checkInDate: form.checkInDate,
              checkOutDate: form.checkOutDate,
              paymentStatus: form.paymentStatus,
            }),
          },
        );

        const data = await readApiResponse(response);
        if (!response.ok) {
          throw new Error(
            data?.error || data?.message || "Failed to update reservation",
          );
        }
      } else {
        const response = await fetch("/api/v1/reservations", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guestId: form.guestId,
            roomId: form.roomId,
            checkInDate: form.checkInDate,
            checkOutDate: form.checkOutDate,
            paymentStatus: form.paymentStatus,
          }),
        });

        const data = await readApiResponse(response);
        if (!response.ok) {
          throw new Error(
            data?.error || data?.message || "Failed to create reservation",
          );
        }
      }

      await loadData();
      setShowModal(false);
      setEditingReservation(null);
      resetForm();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to save reservation",
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedRoom = rooms.find((room) => room.id === form.roomId);
  const displayedPricePerNight = selectedRoom
    ? Number(selectedRoom.basePrice)
    : Number(form.pricePerNight || 0);
  const displayedNights = calculateNights(form.checkInDate, form.checkOutDate);
  const displayedTotal =
    displayedNights > 0 ? displayedPricePerNight * displayedNights : 0;

  return (
    <div className={styles.page}>
      <main className={styles.content}>
        <header className={styles.header}>
          <div className={styles.title}>
            <h1>Reservations</h1>
            <p>{reservations.length} reservations this month</p>
          </div>

          <div className={styles.userInfo}>
            <span>Receptionist</span>
            <span className={styles.userRole}>Receptionist</span>
          </div>
        </header>

        {/* TOOLBAR */}
        <div className={styles.toolbar}>
          <input
            className={styles.search}
            type="text"
            placeholder="Search by guest's name, ID, room number"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setCurrentPage(1);
            }}
          />

          <select
            className={styles.filter}
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All</option>
            <option value="this_month">This month</option>
            <option value="upcoming">Upcoming</option>
            <option value="in_stay">In stay</option>
            <option value="checked_out">Checked-out</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            className={styles.newButton}
            onClick={() => openNewReservation()}
          >
            + New reservation
          </button>
        </div>

        {/* ERROR */}
        {error && !showModal && <div className={styles.error}>{error}</div>}

        {/* LOADING & TABLE */}
        {loading ? (
          <div className={styles.empty}>Loading reservations...</div>
        ) : filteredReservations.length === 0 ? (
          <div className={styles.empty}>No reservations found.</div>
        ) : (
          <>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Room</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Total</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedReservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td>
                        <div className={styles.guest}>
                          <strong>
                            {reservation.guest?.fullName || "Unknown guest"}
                          </strong>
                          {reservation.guest?.phone && (
                            <small>{reservation.guest.phone}</small>
                          )}
                        </div>
                      </td>

                      <td>Room {reservation.room?.roomNumber || "-"}</td>
                      <td>{formatDate(reservation.checkInDate)}</td>
                      <td>{formatDate(reservation.checkOutDate)}</td>

                      <td>
                        <span
                          className={`${styles.status} ${getStatusClass(
                            reservation.status,
                          )}`}
                        >
                          {getStatusLabel(reservation.status)}
                        </span>
                      </td>

                      <td>{reservation.paymentStatus}</td>
                      <td>${formatPrice(reservation.totalPrice)}</td>

                      <td>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          {reservation.status === "BOOKED" && (
                            <button
                              className={styles.editButton}
                              onClick={() => handleCheckIn(reservation.id)}
                            >
                              Check in
                            </button>
                          )}

                          {reservation.status === "CHECKED_IN" && (
                            <button
                              className={styles.editButton}
                              onClick={() => handleCheckOut(reservation.id)}
                            >
                              Check out
                            </button>
                          )}

                          <button
                            className={styles.editButton}
                            onClick={() => openEditReservation(reservation)}
                          >
                            Edit
                          </button>

                          <button
                            className={styles.editButton}
                            onClick={() => handleDelete(reservation.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* REUSABLE PAGINATION COMPONENT */}
            <Pagination
              currentPage={activePage}
              totalPages={totalPages}
              totalItems={filteredReservations.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </>
        )}

        {/* MODAL */}
        {showModal && (
          <div className={styles.overlay}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h2>
                  {editingReservation ? "Edit reservation" : "New reservation"}
                </h2>
                <button
                  className={styles.closeButton}
                  onClick={closeModal}
                  disabled={saving}
                >
                  ×
                </button>
              </div>

              {error && <div className={styles.error}>{error}</div>}

              <form onSubmit={saveReservation}>
                <div className={styles.formGrid}>
                  <label>
                    Guest
                    <select
                      value={form.guestId}
                      onChange={handleGuestChange}
                      required
                    >
                      <option value="">Select guest</option>
                      {guests.map((guest) => (
                        <option key={guest.id} value={guest.id}>
                          {guest.fullName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Room
                    <select
                      value={form.roomId}
                      onChange={handleRoomChange}
                      disabled={!!editingReservation}
                      required
                    >
                      <option value="">Select room</option>
                      {rooms.map((room) => {
                        const unavailable = isRoomCurrentlyUnavailable(room);

                        return (
                          <option
                            key={room.id}
                            value={room.id}
                            disabled={
                              unavailable &&
                              !(
                                editingReservation &&
                                editingReservation.roomId === room.id
                              )
                            }
                          >
                            Room {room.roomNumber} - {room.roomType} -{" "}
                            {getRoomStatusLabel(room.status)}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  <label>
                    Check-in
                    <input
                      type="date"
                      value={form.checkInDate}
                      min={
                        editingReservation &&
                        editingReservation.status !== "BOOKED"
                          ? undefined
                          : today
                      }
                      onChange={handleCheckInChange}
                      required
                    />
                  </label>

                  <label>
                    Check-out
                    <input
                      type="date"
                      value={form.checkOutDate}
                      min={form.checkInDate ? form.checkInDate : today}
                      onChange={handleCheckOutChange}
                      required
                    />
                  </label>

                  <label>
                    Price per night
                    <input
                      type="number"
                      value={displayedPricePerNight}
                      readOnly
                    />
                  </label>

                  <label>
                    Total price
                    <input type="number" value={displayedTotal} readOnly />
                  </label>

                  <label>
                    Status
                    <select value={form.status} disabled>
                      <option value="BOOKED">Upcoming</option>
                      <option value="CHECKED_IN">In stay</option>
                      <option value="CHECKED_OUT">Checked-out</option>
                      <option value="CANCELLED">Cancelled</option>
                      <option value="NO_SHOW">No-show</option>
                    </select>
                  </label>

                  <label>
                    Payment status
                    <select
                      value={form.paymentStatus}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          paymentStatus: event.target.value,
                        }))
                      }
                    >
                      <option value="UNPAID">Unpaid</option>
                      <option value="PAID">Paid</option>
                      <option value="PARTIAL">Partial</option>
                    </select>
                  </label>
                </div>

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.cancelButton}
                    onClick={closeModal}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className={styles.saveButton}
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : editingReservation
                        ? "Save changes"
                        : "Create reservation"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
