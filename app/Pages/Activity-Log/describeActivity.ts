export type ActivityLogItem = {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  user: { fullName: string; role: string } | null;
  metadata: Record<string, unknown> | null;
  context: {
    roomNumber?: string;
    guestName?: string;
    checkInDate?: string;
    checkOutDate?: string;
    targetUserName?: string;
    assigneeName?: string;
  };
};

export type CategoryKey =
  | "reservation"
  | "guest"
  | "room"
  | "housekeeping"
  | "staff"
  | "hotel"
  | "other";

export type ActivityDescription = {
  category: CategoryKey;
  categoryLabel: string;
  /** One plain-English sentence: who-agnostic, e.g. "Checked in Sara Khoury to Room 204". */
  summary: string;
  /** Optional second line with supporting facts (dates, changed fields...). */
  detail?: string;
  /** True for changes a manager should glance at: cancellations, no-shows, account changes. */
  notable: boolean;
};

const CATEGORY_BY_ENTITY: Record<string, { key: CategoryKey; label: string }> =
  {
    reservation: { key: "reservation", label: "Reservation" },
    guest: { key: "guest", label: "Guest" },
    room: { key: "room", label: "Room" },
    housekeeping_task: { key: "housekeeping", label: "Housekeeping" },
    user: { key: "staff", label: "Staff account" },
    hotel: { key: "hotel", label: "Hotel settings" },
  };

const ROOM_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  OCCUPIED: "Occupied",
  NEEDS_CLEANING: "Needs cleaning",
  CLEANING: "Being cleaned",
  OUT_OF_SERVICE: "Out of service",
};

const FIELD_LABELS: Record<string, string> = {
  roomNumber: "room number",
  roomType: "room type",
  basePrice: "price per night",
  status: "status",
  fullName: "name",
  phone: "phone",
  email: "email",
  passportNumber: "passport number",
  note: "note",
  notes: "notes",
  role: "role",
  isActive: "active/inactive status",
  password: "password",
  checkInDate: "check-in date",
  checkOutDate: "check-out date",
  assignedToUserId: "assigned staff member",
  name: "hotel name",
  address: "hotel address",
  checkInTime: "check-in time",
  checkOutTime: "check-out time",
  currency: "currency",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** `changes` is an object (rooms, guests, reservations) or a plain list of field names (users). */
function changedFieldKeys(meta: Record<string, unknown>): string[] {
  const changes = meta.changes;
  if (Array.isArray(changes))
    return changes.filter((c): c is string => typeof c === "string");
  return Object.keys(asRecord(changes));
}

function fieldList(keys: string[]): string | undefined {
  if (keys.length === 0) return undefined;
  const labels = keys.map((key) => FIELD_LABELS[key] ?? key);
  return `Changed: ${labels.join(", ")}`;
}

function shortDate(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function stayDetail(checkIn?: string, checkOut?: string): string | undefined {
  const from = shortDate(checkIn);
  const to = shortDate(checkOut);
  if (!from || !to || !checkIn || !checkOut) return undefined;

  const nights = Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000,
  );
  return `${from} → ${to} · ${nights} ${nights === 1 ? "night" : "nights"}`;
}

function prettifyAction(action: string): string {
  const words = action.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function describeActivity(item: ActivityLogItem): ActivityDescription {
  const meta = asRecord(item.metadata);
  const ctx = item.context;
  const category = CATEGORY_BY_ENTITY[item.entityType] ?? {
    key: "other" as const,
    label: "Other",
  };

  const room = ctx.roomNumber ? `Room ${ctx.roomNumber}` : "a room";
  const guest = ctx.guestName ?? "a guest";
  const changes = asRecord(meta.changes);
  const fields = changedFieldKeys(meta);

  const base = {
    category: category.key,
    categoryLabel: category.label,
    notable: false,
  };

  switch (item.action) {
    // ---- Reservations ----
    case "RESERVATION_CREATED":
      return {
        ...base,
        summary: `Booked ${room} for ${guest}`,
        detail: stayDetail(ctx.checkInDate, ctx.checkOutDate),
      };

    case "RESERVATION_UPDATED": {
      const status =
        typeof changes.status === "string" ? changes.status : undefined;
      if (status === "CANCELLED") {
        return {
          ...base,
          summary: `Cancelled the reservation for ${guest} (${room})`,
          notable: true,
        };
      }
      if (status === "NO_SHOW") {
        return {
          ...base,
          summary: `Marked ${guest} as a no-show (${room})`,
          notable: true,
        };
      }
      return {
        ...base,
        summary: `Edited the reservation for ${guest} (${room})`,
        detail: fieldList(fields),
      };
    }

    case "RESERVATION_CHECKED_IN":
      return { ...base, summary: `Checked in ${guest} to ${room}` };

    case "RESERVATION_CHECKED_OUT":
      return { ...base, summary: `Checked out ${guest} from ${room}` };

    // ---- Rooms ----
    case "ROOM_CREATED":
      return { ...base, summary: `Added ${room} to the hotel` };

    case "ROOM_UPDATED": {
      const status =
        typeof changes.status === "string" ? changes.status : undefined;
      if (status && fields.length === 1) {
        return {
          ...base,
          summary: `Set ${room} to "${ROOM_STATUS_LABELS[status] ?? status}"`,
          notable: status === "OUT_OF_SERVICE",
        };
      }
      return { ...base, summary: `Updated ${room}`, detail: fieldList(fields) };
    }

    case "ROOM_STATUS_CHANGED": {
      const from = typeof meta.from === "string" ? meta.from : undefined;
      const to = typeof meta.to === "string" ? meta.to : undefined;
      return {
        ...base,
        summary: `Changed ${room} status`,
        detail:
          from && to
            ? `${ROOM_STATUS_LABELS[from] ?? from} → ${ROOM_STATUS_LABELS[to] ?? to}`
            : undefined,
        notable: to === "OUT_OF_SERVICE",
      };
    }

    // ---- Guests ----
    case "GUEST_CREATED":
      return { ...base, summary: `Added a new guest: ${guest}` };

    case "GUEST_UPDATED":
      return {
        ...base,
        summary: `Updated details for ${guest}`,
        detail: fieldList(fields),
      };

    // ---- Staff accounts ----
    case "USER_CREATED": {
      const role =
        typeof meta.role === "string" ? meta.role.toLowerCase() : "staff";
      return {
        ...base,
        summary: `Created a ${role} account for ${ctx.targetUserName ?? "a new staff member"}`,
        notable: true,
      };
    }

    case "USER_UPDATED": {
      const name = ctx.targetUserName ?? "a staff member";
      const resetPassword = fields.includes("password");
      return {
        ...base,
        summary: resetPassword
          ? `Reset the password for ${name}`
          : `Updated the account of ${name}`,
        detail: fieldList(fields.filter((f) => f !== "password")),
        notable: true,
      };
    }

    // ---- Hotel settings ----
    case "HOTEL_SETTINGS_UPDATED":
      return {
        ...base,
        summary: "Updated hotel settings",
        detail: fieldList(fields),
      };

    // ---- Housekeeping ----
    case "HOUSEKEEPING_TASK_CREATED":
      return {
        ...base,
        summary: `Assigned cleaning of ${room} to ${ctx.assigneeName ?? "a housekeeper"}`,
      };

    case "HOUSEKEEPING_TASK_REASSIGNED":
      return {
        ...base,
        summary: `Changed who cleans ${room}`,
        detail: ctx.assigneeName
          ? `Now assigned to ${ctx.assigneeName}`
          : fieldList(fields),
      };

    case "HOUSEKEEPING_TASK_STARTED":
      return { ...base, summary: `Started cleaning ${room}` };

    case "HOUSEKEEPING_TASK_COMPLETED": {
      const photos = typeof meta.photoCount === "number" ? meta.photoCount : 0;
      return {
        ...base,
        summary: `Finished cleaning ${room}`,
        detail:
          photos > 0
            ? `${photos} ${photos === 1 ? "photo" : "photos"} attached`
            : undefined,
      };
    }

    default:
      return { ...base, summary: prettifyAction(item.action) };
  }
}
