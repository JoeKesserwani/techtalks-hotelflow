"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Role } from "@/app/generated/prisma/enums";
import styles from "./page.module.css";
import { useAuth } from "@/components/Auth/AuthProvider";

type StaffMember = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
};

type StaffForm = {
  fullName: string;
  email: string;
  password: string;
  role: Role;
};

const roleOptions = Object.values(Role).filter(
  (role) => role !== Role.ADMIN,
);
const emptyForm: StaffForm = {
  fullName: "",
  email: "",
  password: "",
  role: Role.RECEPTIONIST,
};

const formatRole = (role: Role) =>
  role.charAt(0) + role.slice(1).toLowerCase().replace("_", " ");

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const {user} = useAuth();
  async function loadStaff() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/users");

      if (!response.ok) {
        throw new Error("Unable to load staff members.");
      }

      setStaff(await response.json());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load staff members.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchStaff() {
      try {
        const response = await fetch("/api/v1/users");

        if (!response.ok) {
          throw new Error("Unable to load staff members.");
        }

        const data = await response.json();
        if (!cancelled) setStaff(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load staff members.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void fetchStaff();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredStaff = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return normalizedQuery
      ? staff.filter((member) =>
          [member.fullName, member.email, formatRole(member.role)]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
        )
      : staff;
  }, [query, staff]);

  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedStaff = useMemo(() => {
    if (filteredStaff.length <= pageSize) {
      return filteredStaff;
    }

    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredStaff.slice(startIndex, startIndex + pageSize);
  }, [filteredStaff, pageSize, safeCurrentPage]);

  function closeDialog() {
    if (!isSaving) {
      setMode(null);
      setSelectedStaff(null);
      setForm(emptyForm);
      setFormError(null);
    }
  }

  function openCreateDialog() {
    setSelectedStaff(null);
    setForm(emptyForm);
    setFormError(null);
    setMode("create");
  }

  function openEditDialog(member: StaffMember) {
    setSelectedStaff(member);
    setForm({
      fullName: member.fullName,
      email: member.email,
      password: "",
      role: member.role,
    });
    setFormError(null);
    setMode("edit");
  }

  function updateForm<Key extends keyof StaffForm>(
    key: Key,
    value: StaffForm[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  async function saveStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSaving(true);

    const isCreate = mode === "create";
    const payload = isCreate
      ? form
      : {
          fullName: form.fullName,
          email: form.email,
          role: form.role,
          ...(form.password ? { password: form.password } : {}),
        };

    try {
      const response = await fetch(
        isCreate ? "/api/v1/users" : `/api/v1/users/${selectedStaff?.id}`,
        {
          method: isCreate ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.message ?? result?.error ?? "Unable to save staff member.",
        );
      }

      await loadStaff();
      setMode(null);
      setSelectedStaff(null);
      setForm(emptyForm);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to save staff member.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deactivateStaff() {
    if (
      !selectedStaff ||
      !window.confirm(`Deactivate ${selectedStaff.fullName}?`)
    ) {
      return;
    }

    setFormError(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/v1/users/${selectedStaff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.message ??
            result?.error ??
            "Unable to deactivate staff member.",
        );
      }

      await loadStaff();
      setMode(null);
      setSelectedStaff(null);
      setForm(emptyForm);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Unable to deactivate staff member.",
      );
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Staff Management</h1>
          <p>
            {staff.length} {staff.length === 1 ? "account" : "accounts"} ·
            Manage roles and access
          </p>
        </div>
        <div className={styles.role}>
            <div className={styles.roleInfo}>
              <strong>{user?.fullName}</strong>
              <span>Currently reviewing rooms</span>
            </div>

            <div className={styles.roleBadge}>
              {user?.role }
            </div>
          </div>
      </header>

      <section className={styles.toolbar} aria-label="Staff controls">
        <label className={styles.searchLabel}>
          <span className="sr-only">Search staff</span>
          <input
            type="search"
            placeholder="Search staff by name, email or Role"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCurrentPage(1);
            }}
          />
        </label>
        <button
          type="button"
          className={styles.addButton}
          onClick={openCreateDialog}
        >
          + Add staff
        </button>
      </section>

      {error ? (
        <div className={styles.message} role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void loadStaff()}>
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <p className={styles.loading}>Loading staff…</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Added</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedStaff.map((member) => (
                <tr key={member.id}>
                  <td>
                    <div className={styles.member}>
                      <span className={styles.avatar} aria-hidden="true">
                        {member.fullName.charAt(0).toUpperCase()}
                      </span>
                      <span>
                        <strong>{member.fullName}</strong>
                        <small>{member.email}</small>
                      </span>
                    </div>
                  </td>
                  <td>{formatRole(member.role)}</td>
                  <td>
                    <span
                      className={
                        member.isActive ? styles.active : styles.inactive
                      }
                    >
                      {member.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{formatDate(member.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.editButton}
                      onClick={() => openEditDialog(member)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filteredStaff.length === 0 && (
                <tr>
                  <td className={styles.empty} colSpan={5}>
                    No staff members match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {filteredStaff.length > pageSize && (
            <div className={styles.pagination} aria-label="Staff pagination">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safeCurrentPage === 1}
              >
                Previous
              </button>
              <span>
                Page {safeCurrentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                disabled={safeCurrentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {mode && (
        <div
          className={styles.dialogLayer}
          role="presentation"
          onMouseDown={closeDialog}
        >
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.dialogHeader}>
              <div>
                <h2 id="staff-dialog-title">
                  {mode === "create" ? "Add staff member" : "Edit staff member"}
                </h2>
                <p>
                  {mode === "create"
                    ? "Create a new account and assign access."
                    : "Update access and account details."}
                </p>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={closeDialog}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>

            <form onSubmit={saveStaff}>
              <label>
                Full name
                <input
                  required
                  value={form.fullName}
                  maxLength={30}
                  onChange={(event) =>
                    updateForm("fullName", event.target.value)
                  }
                />
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  autoComplete="off"
                  data-lpignore="true"         
                  data-1pignore="true"
                  maxLength={40}
                  value={form.email}
                  onChange={(event) => updateForm("email", event.target.value)}
                />
              </label>
              <label>
                {mode === "create" ? "Password" : "New password (optional)"}
                <input
                  required={mode === "create"}
                  minLength={8}
                  maxLength={20}
                  type="password"
                  value={form.password}
                  autoComplete="off"
                  data-lpignore="true"         
                  data-1pignore="true"
                  onChange={(event) =>
                    updateForm("password", event.target.value)
                  }
                />
              </label>
              <label>
                Role
                <select
                  value={form.role}
                  onChange={(event) =>
                    updateForm("role", event.target.value as Role)
                  }
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {formatRole(role)}
                    </option>
                  ))}
                </select>
              </label>

              {formError && (
                <p className={styles.formError} role="alert">
                  {formError}
                </p>
              )}

              <div className={styles.dialogActions}>
                {mode === "edit" && selectedStaff?.isActive && (
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={() => void deactivateStaff()}
                    disabled={isSaving}
                  >
                    Deactivate
                  </button>
                )}
                <span />
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={closeDialog}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.saveButton}
                  disabled={isSaving}
                >
                  {isSaving
                    ? "Saving…"
                    : mode === "create"
                      ? "Add staff"
                      : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
