"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Pagination from "@/components/Pagination";
import styles from "./rooms.module.css";
import { useAuth } from "@/components/Auth/AuthProvider";

type RoomStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "OCCUPIED"
  | "IN_REVIEW"
  | "NEEDS_CLEANING"
  | "CLEANING"
  | "OUT_OF_SERVICE";

const roomTypes = [
  "Single",
  "Double",
  "Twin",
  "Triple",
  "Quadruple",
  "Family",
] as const;

type Room = {
  id: string;
  roomNumber: string;
  roomType: string;
  floor: number;
  capacity: number;
  basePrice: number;
  status: RoomStatus;
};

const roomStatuses: RoomStatus[] = [
  "AVAILABLE",
  "RESERVED",
  "OCCUPIED",
  "IN_REVIEW",
  "NEEDS_CLEANING",
  "CLEANING",
  "OUT_OF_SERVICE",
];

function getRoomStatusLabel(status: RoomStatus) {
  switch (status) {
    case "AVAILABLE":
      return "Available";
    case "RESERVED":
      return "Upcoming";
    case "OCCUPIED":
      return "In stay";
    case "IN_REVIEW":
      return "In review";
    case "NEEDS_CLEANING":
      return "Needs cleaning";
    case "CLEANING":
      return "Cleaning";
    case "OUT_OF_SERVICE":
      return "Out of service";
    default:
      return status;
  }
}

function getStatusClass(status: RoomStatus) {
  switch (status) {
    case "AVAILABLE":
      return styles.availableStatus;

    case "RESERVED":
      return styles.reservedStatus;

    case "OCCUPIED":
      return styles.occupiedStatus;

    case "IN_REVIEW":
      return styles.inReviewStatus;

    case "NEEDS_CLEANING":
      return styles.cleaningStatus;

    case "CLEANING":
      return styles.cleaningStatus;

    case "OUT_OF_SERVICE":
      return styles.outOfServiceStatus;

    default:
      return styles.availableStatus;
  }
}

function sortRoomsByNumber(rooms: Room[]) {
  return [...rooms].sort((a, b) => Number(a.roomNumber) - Number(b.roomNumber));
}

const Page = () => {
  const { user } = useAuth();
  const router = useRouter();

  /* -------------------------------------------------------------------------- */
  /* Rooms                                                                      */
  /* -------------------------------------------------------------------------- */

  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* -------------------------------------------------------------------------- */
  /* Search + Filters                                                           */
  /* -------------------------------------------------------------------------- */

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RoomStatus | "">("");
  const [roomTypeFilter, setRoomTypeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const roomsPerPage = 8;

  /* -------------------------------------------------------------------------- */
  /* Edit Room                                                                  */
  /* -------------------------------------------------------------------------- */

  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const [roomNumber, setRoomNumber] = useState("");
  const [roomType, setRoomType] = useState("");
  const [floor, setFloor] = useState("");
  const [capacity, setCapacity] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [status, setStatus] = useState<RoomStatus>("AVAILABLE");

  const [roomTypeChanged, setRoomTypeChanged] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /* -------------------------------------------------------------------------- */
  /* Add Room                                                                   */
  /* -------------------------------------------------------------------------- */

  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);

  const [newRoomNumber, setNewRoomNumber] = useState("");
  const [newRoomType, setNewRoomType] = useState("");
  const [newFloor, setNewFloor] = useState("");
  const [newCapacity, setNewCapacity] = useState("");
  const [newBasePrice, setNewBasePrice] = useState("");

  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  /* -------------------------------------------------------------------------- */
  /* Load Rooms                                                                 */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    async function loadRooms() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/v1/rooms");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load rooms.");
        }

        setRooms(sortRoomsByNumber(data as Room[]));
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Unable to load rooms.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadRooms();
  }, []);

  /* -------------------------------------------------------------------------- */
  /* Filter Rooms                                                               */
  /* -------------------------------------------------------------------------- */

  const filteredRooms = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return rooms.filter((room) => {
      const matchesSearch =
        !searchValue ||
        room.roomNumber.toLowerCase().includes(searchValue) ||
        room.roomType.toLowerCase().includes(searchValue);

      const matchesStatus = !statusFilter || room.status === statusFilter;

      const matchesRoomType =
        !roomTypeFilter || room.roomType === roomTypeFilter;

      return matchesSearch && matchesStatus && matchesRoomType;
    });
  }, [rooms, search, statusFilter, roomTypeFilter]);

  /* -------------------------------------------------------------------------- */
  /* Pagination                                                                 */
  /* -------------------------------------------------------------------------- */

  const totalPages = Math.ceil(filteredRooms.length / roomsPerPage);

  const paginatedRooms = useMemo(() => {
    const startIndex = (currentPage - 1) * roomsPerPage;
    const endIndex = startIndex + roomsPerPage;

    return filteredRooms.slice(startIndex, endIndex);
  }, [filteredRooms, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, roomTypeFilter]);

  /* -------------------------------------------------------------------------- */
  /* Open Add Modal                                                             */
  /* -------------------------------------------------------------------------- */

  function openAddRoom() {
    setIsAddRoomOpen(true);

    setNewRoomNumber("");
    setNewRoomType("");
    setNewFloor("");
    setNewCapacity("");
    setNewBasePrice("");
    setCreateError(null);
  }

  /* -------------------------------------------------------------------------- */
  /* Close Add Modal                                                            */
  /* -------------------------------------------------------------------------- */

  function closeAddRoom() {
    if (isCreating) {
      return;
    }

    setIsAddRoomOpen(false);
    setCreateError(null);
  }

  /* -------------------------------------------------------------------------- */
  /* Create Room                                                                */
  /* -------------------------------------------------------------------------- */

  async function createRoom() {
    setCreateError(null);

    if (!newRoomNumber.trim()) {
      setCreateError("Room number is required.");
      return;
    }

    if (!newRoomType) {
      setCreateError("Room type is required.");
      return;
    }

    if (!newFloor.trim()) {
      setCreateError("Floor is required.");
      return;
    }

    if (!newCapacity.trim()) {
      setCreateError("Capacity is required.");
      return;
    }

    if (!newBasePrice.trim()) {
      setCreateError("Base price is required.");
      return;
    }

    const floorNumber = Number(newFloor);
    const capacityNumber = Number(newCapacity);
    const priceNumber = Number(newBasePrice);

    if (!Number.isInteger(floorNumber) || floorNumber < 1) {
      setCreateError("Please enter a valid floor number.");
      return;
    }

    if (!Number.isInteger(capacityNumber) || capacityNumber < 1) {
      setCreateError("Please enter a valid capacity.");
      return;
    }

    if (Number.isNaN(priceNumber) || priceNumber < 0) {
      setCreateError("Please enter a valid base price.");
      return;
    }

    try {
      setIsCreating(true);

      const response = await fetch("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomNumber: newRoomNumber.trim(),
          roomType: newRoomType,
          floor: floorNumber,
          capacity: capacityNumber,
          basePrice: priceNumber,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to create room.");
      }

      const createdRoom = data as Room;

      setRooms((currentRooms) =>
        sortRoomsByNumber([...currentRooms, createdRoom]),
      );

      setIsAddRoomOpen(false);
      setCreateError(null);
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Unable to create room.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Open Edit Modal                                                            */
  /* -------------------------------------------------------------------------- */

  function openEditRoom(room: Room) {
    setEditingRoom(room);

    setRoomNumber(room.roomNumber);
    setRoomType(room.roomType);
    setFloor(String(room.floor));
    setCapacity(String(room.capacity));
    setBasePrice(String(room.basePrice));
    setStatus(room.status);

    setRoomTypeChanged(false);
    setSaveError(null);
  }

  /* -------------------------------------------------------------------------- */
  /* Close Edit Modal                                                           */
  /* -------------------------------------------------------------------------- */

  function closeEditRoom() {
    if (isSaving) {
      return;
    }

    setEditingRoom(null);
    setSaveError(null);
  }

  /* -------------------------------------------------------------------------- */
  /* Save Room                                                                  */
  /* -------------------------------------------------------------------------- */

  async function saveRoom() {
    if (!editingRoom) {
      return;
    }

    setSaveError(null);

    if (!roomNumber.trim()) {
      setSaveError("Room number is required.");
      return;
    }

    if (!roomType) {
      setSaveError("Room type is required.");
      return;
    }

    if (!floor.trim()) {
      setSaveError("Floor is required.");
      return;
    }

    if (!capacity.trim()) {
      setSaveError("Capacity is required.");
      return;
    }

    if (!basePrice.trim()) {
      setSaveError("Base price is required.");
      return;
    }

    const floorNumber = Number(floor);
    const capacityNumber = Number(capacity);
    const priceNumber = Number(basePrice);

    if (!Number.isInteger(floorNumber) || floorNumber < 1) {
      setSaveError("Please enter a valid floor number.");
      return;
    }

    if (!Number.isInteger(capacityNumber) || capacityNumber < 1) {
      setSaveError("Please enter a valid capacity.");
      return;
    }

    if (Number.isNaN(priceNumber) || priceNumber < 0) {
      setSaveError("Please enter a valid base price.");
      return;
    }

    if (roomTypeChanged && priceNumber === Number(editingRoom.basePrice)) {
      setSaveError(
        "Please review and update the base price because the room type has changed.",
      );

      return;
    }

    try {
      setIsSaving(true);

      const response = await fetch(`/api/v1/rooms/${editingRoom.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomNumber: roomNumber.trim(),
          roomType,
          floor: floorNumber,
          capacity: capacityNumber,
          basePrice: priceNumber,
          status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to update room.");
      }

      const updatedRoom = data as Room;

      setRooms((currentRooms) =>
        sortRoomsByNumber(
          currentRooms.map((room) =>
            room.id === updatedRoom.id ? updatedRoom : room,
          ),
        ),
      );

      setEditingRoom(null);
      setSaveError(null);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Unable to update room.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* View Room                                                                  */
  /* -------------------------------------------------------------------------- */

  function viewRoom(roomId: string) {
    router.push(`/Pages/Rooms/view-room/${roomId}`);
  }

  /* -------------------------------------------------------------------------- */
  /* Render                                                                     */
  /* -------------------------------------------------------------------------- */

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        {/* Header */}
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Room Setup</h1>

            <p className={styles.subtitle}>
              {rooms.length} rooms across{" "}
              {new Set(rooms.map((room) => room.floor)).size} floors
            </p>
          </div>

          <div className={styles.role}>
            <div className={styles.roleInfo}>
              <strong>{user?.fullName}</strong>

              <span>Currently managing rooms</span>
            </div>

            <div className={styles.roleBadge}>{user?.role}</div>
          </div>
        </header>

        {/* Search + Filters + Add Room */}
        <div className={styles.toolbar}>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by room number or type"
            className={styles.searchInput}
            maxLength={30}
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as RoomStatus | "")
            }
            className={styles.filterSelect}
          >
            <option value="">All statuses</option>

            {roomStatuses.map((roomStatus) => (
              <option key={roomStatus} value={roomStatus}>
                {getRoomStatusLabel(roomStatus)}
              </option>
            ))}
          </select>

          <select
            value={roomTypeFilter}
            onChange={(event) => setRoomTypeFilter(event.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All room types</option>

            {roomTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {user?.role !== "RECEPTIONIST" && (
            <button
              type="button"
              className={styles.addButton}
              onClick={openAddRoom}
            >
              + Add Room
            </button>
          )}
          
            
        </div>

        {/* Room Table */}
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Room</th>
                <th>Type</th>
                <th>Floor</th>
                <th>Capacity</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {/* Loading */}
              {isLoading && (
                <tr>
                  <td colSpan={6} className={styles.tableMessage}>
                    Loading rooms...
                  </td>
                </tr>
              )}

              {/* Error */}
              {!isLoading && error && (
                <tr>
                  <td colSpan={6} className={styles.tableMessage}>
                    {error}
                  </td>
                </tr>
              )}

              {/* No results */}
              {!isLoading && !error && filteredRooms.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.tableMessage}>
                    {search || statusFilter || roomTypeFilter
                      ? "No rooms match your filters."
                      : "No rooms have been added yet."}
                  </td>
                </tr>
              )}

              {/* Rooms */}
              {!isLoading &&
                !error &&
                paginatedRooms.map((room) => (
                  <tr key={room.id}>
                    <td className={styles.roomNumber}>{room.roomNumber}</td>

                    <td>{room.roomType}</td>

                    <td>{room.floor}</td>

                    <td>
                      {room.capacity} {room.capacity === 1 ? "guest" : "guests"}
                    </td>

                    <td>
                      <span className={getStatusClass(room.status)}>
                        {getRoomStatusLabel(room.status)}
                      </span>
                    </td>

                    <td>
                      <div className={styles.roomActions}>
                        <button
                          type="button"
                          className={styles.viewButton}
                          onClick={() => viewRoom(room.id)}
                        >
                          View
                        </button>
                        {user?.role !== "RECEPTIONIST" && (
                        <button
                          type="button"
                          className={styles.editButton}
                          onClick={() => openEditRoom(room)}
                        >
                          Edit
                        </button>)}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && !error && filteredRooms.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredRooms.length}
            itemsPerPage={roomsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </main>

      {/* ================================================================== */}
      {/* ADD ROOM MODAL                                                     */}
      {/* ================================================================== */}

      {isAddRoomOpen && (
        <div className={styles.modalOverlay}>
          <div
            className={styles.editModal}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalLabel}>ROOM SETUP</p>

                <h2>Add Room</h2>
              </div>

              <button
                type="button"
                className={styles.closeButton}
                onClick={closeAddRoom}
                disabled={isCreating}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="newRoomNumber">Room number</label>

                <input
                  id="newRoomNumber"
                  type="text"
                  value={newRoomNumber}
                  onChange={(event) => setNewRoomNumber(event.target.value)}
                  placeholder="e.g. 101"
                  maxLength={10}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="newRoomType">Room type</label>

                <select
                  id="newRoomType"
                  value={newRoomType}
                  onChange={(event) => setNewRoomType(event.target.value)}
                >
                  <option value="">Select room type</option>

                  {roomTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="newFloor">Floor</label>

                  <input
                    id="newFloor"
                    type="number"
                    min="1"
                    max="20"
                    value={newFloor}
                    onChange={(event) => setNewFloor(event.target.value)}
                    placeholder="e.g. 1"
                    maxLength={2}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="newCapacity">Capacity</label>

                  <input
                    id="newCapacity"
                    type="number"
                    min="1"
                    max="10"
                    value={newCapacity}
                    onChange={(event) => setNewCapacity(event.target.value)}
                    placeholder="e.g. 2"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="newBasePrice">Base price</label>

                <input
                  id="newBasePrice"
                  type="number"
                  min="0"
                  step="1"
                  max="9999"
                  value={newBasePrice}
                  onChange={(event) => setNewBasePrice(event.target.value)}
                  placeholder="e.g. 120"
                  maxLength={4}
                />
              </div>

              {createError && <p className={styles.formError}>{createError}</p>}
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={closeAddRoom}
                disabled={isCreating}
              >
                Cancel
              </button>

              <button
                type="button"
                className={styles.saveButton}
                onClick={createRoom}
                disabled={isCreating}
              >
                {isCreating ? "Adding..." : "Add Room"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* EDIT ROOM MODAL                                                    */}
      {/* ================================================================== */}

      {editingRoom && (
        <div className={styles.modalOverlay}>
          <div
            className={styles.editModal}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalLabel}>ROOM SETUP</p>

                <h2>Edit Room {editingRoom.roomNumber}</h2>
              </div>

              <button
                type="button"
                className={styles.closeButton}
                onClick={closeEditRoom}
                disabled={isSaving}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="roomNumber">Room number</label>

                <input
                  id="roomNumber"
                  type="text"
                  value={roomNumber}
                  onChange={(event) => setRoomNumber(event.target.value)}
                  maxLength={10}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="roomType">Room type</label>

                <select
                  id="roomType"
                  value={roomType}
                  onChange={(event) => {
                    const newType = event.target.value;

                    setRoomType(newType);

                    setRoomTypeChanged(
                      editingRoom !== null && newType !== editingRoom.roomType,
                    );
                  }}
                >
                  <option value="">Select room type</option>

                  {roomTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="floor">Floor</label>

                  <input
                    id="floor"
                    type="number"
                    min="1"
                    max="20"
                    value={floor}
                    onChange={(event) => setFloor(event.target.value)}
                    maxLength={2}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="capacity">Capacity</label>

                  <input
                    id="capacity"
                    type="number"
                    min="1"
                    max="10"
                    value={capacity}
                    onChange={(event) => setCapacity(event.target.value)}
                    maxLength={2}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="basePrice">Base price</label>

                <input
                  id="basePrice"
                  type="number"
                  min="0"
                  step="1"
                  max="9999"
                  value={basePrice}
                  onChange={(event) => setBasePrice(event.target.value)}
                  maxLength={4}
                />

                <p className={styles.priceWarning}>
                  ⚠ Please review the base price before saving.
                </p>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="status">Status</label>

                <select
                  id="status"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as RoomStatus)
                  }
                >
                  {roomStatuses.map((roomStatus) => (
                    <option key={roomStatus} value={roomStatus}>
                      {getRoomStatusLabel(roomStatus)}
                    </option>
                  ))}
                </select>
              </div>

              {saveError && <p className={styles.formError}>{saveError}</p>}
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={closeEditRoom}
                disabled={isSaving}
              >
                Cancel
              </button>

              <button
                type="button"
                className={styles.saveButton}
                onClick={saveRoom}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Page;
