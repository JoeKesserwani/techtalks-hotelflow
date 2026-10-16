
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CircleCheck,
  CircleMinus,
  Mail,
  Pencil,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Role } from "@/app/generated/prisma/enums";
import styles from "./staff.module.css";
import Pagination from "@/components/Pagination";
import Header from "@/components/Header/Header";

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

type AccountFilter = "all" | "active" | "inactive";
type RoleFilter = Role | "all";

const roleOptions = Object.values(Role).filter((role) => role !== Role.ADMIN);
type RoleFilter = Role | "all";

const emptyForm: StaffForm = {
  fullName: "",
  email: "",
  password: "",
  role: Role.RECEPTIONIST,
};

const formatRole = (role: Role) =>
  role.charAt(0) + role.slice(1).toLowerCase().replace("_", " ");

const roleFilterOptions: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All roles" },
  ...Object.values(Role)
    .filter((role) => role !== Role.ADMIN)
    .map((role) => ({
      value: role,
      label: formatRole(role),
    })),
];

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

const PAGE_SIZE = 8;

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState<StaffForm>(emptyForm);

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

    return staff.filter((member) => {
      const matchesQuery =
        !normalizedQuery ||
        [member.fullName, member.email, formatRole(member.role)]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesStatus =
        accountFilter === "all" ||
        member.isActive === (accountFilter === "active");
      const matchesRole = roleFilter === "all" || member.role === roleFilter;

      return matchesQuery && matchesStatus && matchesRole;
    });
  }, [accountFilter, query, roleFilter, staff]);

  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const activeCount = staff.filter((member) => member.isActive).length;
  const inactiveCount = staff.length - activeCount;
  const hasFilters =
    !!query.trim() || accountFilter !== "all" || roleFilter !== "all";

  const paginatedStaff = useMemo(() => {
    if (filteredStaff.length <= PAGE_SIZE) {
      return filteredStaff;
    }

    const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredStaff.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredStaff, safeCurrentPage]);

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
  async function ActivateStaff() {
    if (
      !selectedStaff ||
      !window.confirm(`Activate ${selectedStaff.fullName}?`)
    ) {
      return;
    }

    setFormError(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/v1/users/${selectedStaff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.message ??
            result?.error ??
            "Unable to activate staff member.",
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
          : "Unable to activate staff member.",
      );
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <main className={styles.page}>
      <div className={styles.pageInner}>
        <Header
          title="Staff"
          subtitle="Manage team accounts, roles and access."
          userSubtitle="Team administration"
        />

        <section className={styles.metrics} aria-label="Staff overview">
          <article className={styles.metric}>
            <span className={`${styles.metricIcon} ${styles.metricTotal}`}>
              <Users size={19} aria-hidden="true" />
            </span>
            <span className={styles.metricCopy}>
              <span className={styles.metricLabel}>Team members</span>
              <strong className={styles.metricValue}>{staff.length}</strong>
              <span className={styles.metricFoot}>Staff accounts</span>
            </span>
          </article>
          <article className={styles.metric}>
            <span className={`${styles.metricIcon} ${styles.metricActive}`}>
              <CircleCheck size={19} aria-hidden="true" />
            </span>
            <span className={styles.metricCopy}>
              <span className={styles.metricLabel}>Active access</span>
              <strong className={styles.metricValue}>{activeCount}</strong>
              <span className={styles.metricFoot}>Can sign in</span>
            </span>
          </article>
          <article className={styles.metric}>
            <span className={`${styles.metricIcon} ${styles.metricInactive}`}>
              <CircleMinus size={19} aria-hidden="true" />
            </span>
            <span className={styles.metricCopy}>
              <span className={styles.metricLabel}>Inactive</span>
              <strong className={styles.metricValue}>{inactiveCount}</strong>
              <span className={styles.metricFoot}>Access disabled</span>
            </span>
          </article>
        </section>

        <section className={styles.directory} aria-labelledby="directory-title">
          <div className={styles.directoryHeader}>
            <div>
              <p className={styles.eyebrow}>People &amp; permissions</p>
              <h2 id="directory-title">Staff directory</h2>
              <p className={styles.directoryDescription}>
                Review account status and manage each team member’s access.
              </p>
            </div>
            <span className={styles.resultCount}>
              {filteredStaff.length}{" "}
              {filteredStaff.length === 1 ? "member" : "members"}
            </span>
          </div>

          <div className={styles.toolbar}>
            <label className={styles.searchField}>
              <Search size={17} aria-hidden="true" />
              <span className={styles.visuallyHidden}>Search staff</span>
              <input
                type="search"
                placeholder="Search name, email or role"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCurrentPage(1);
                }}
                maxLength={40}
              />
            </label>

            <label className={styles.roleFilter}>
              <span>Role</span>
              <select
                value={roleFilter}
                onChange={(event) => {
                  setRoleFilter(event.target.value as RoleFilter);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All roles</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {formatRole(role)}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className={styles.addButton}
              onClick={openCreateDialog}
            >
              <UserPlus size={17} aria-hidden="true" />
              <span>Add staff</span>
            </button>
          </div>

          <div
            className={styles.statusFilters}
            role="group"
            aria-label="Filter staff by account status"
          >
            <button
              type="button"
              className={
                accountFilter === "all"
                  ? styles.filterActive
                  : styles.filterButton
              }
              aria-pressed={accountFilter === "all"}
              onClick={() => {
                setAccountFilter("all");
                setCurrentPage(1);
              }}
            >
              All staff <span>{staff.length}</span>
            </button>
            <button
              type="button"
              className={
                accountFilter === "active"
                  ? styles.filterActive
                  : styles.filterButton
              }
              aria-pressed={accountFilter === "active"}
              onClick={() => {
                setAccountFilter("active");
                setCurrentPage(1);
              }}
            >
              Active <span>{activeCount}</span>
            </button>
            <button
              type="button"
              className={
                accountFilter === "inactive"
                  ? styles.filterActive
                  : styles.filterButton
              }
              aria-pressed={accountFilter === "inactive"}
              onClick={() => {
                setAccountFilter("inactive");
                setCurrentPage(1);
              }}
            >
              Inactive <span>{inactiveCount}</span>
            </button>
          </div>

          {error ? (
            <div className={styles.message} role="alert">
              <p>{error}</p>
              <button type="button" onClick={() => void loadStaff()}>
                Try again
              </button>
            </div>
          ) : isLoading ? (
            <div className={styles.loading} role="status">
              <span className={styles.spinner} aria-hidden="true" />
              Loading staff accounts…
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>
                <Users size={22} aria-hidden="true" />
              </span>
              <h3>
                {staff.length ? "No matching staff" : "No staff accounts yet"}
              </h3>
              <p>
                {staff.length
                  ? "Try a different search or filter."
                  : "Add a staff account to give your team access."}
              </p>
              {staff.length === 0 && (
                <button
                  type="button"
                  className={styles.addButton}
                  onClick={openCreateDialog}
                >
                  <UserPlus size={17} aria-hidden="true" />
                  Add staff
                </button>
              )}
            </div>
          ) : (
            <div className={styles.tableViewport}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Team member</th>
                    <th scope="col">Role</th>
                    <th scope="col">Account status</th>
                    <th scope="col">Date added</th>
                    <th scope="col" className={styles.actionsHeading}>
                      <span className={styles.visuallyHidden}>Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStaff.map((member) => (
                    <tr key={member.id}>
                      <td data-label="Team member">
                        <div className={styles.member}>
                          <span className={styles.avatar} aria-hidden="true">
                            {initials(member.fullName)}
                          </span>
                          <span className={styles.memberInfo}>
                            <strong>{member.fullName}</strong>
                            <span className={styles.email}>
                              <Mail size={14} aria-hidden="true" />
                              {member.email}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td data-label="Role">
                        <span className={styles.roleValue}>
                          <ShieldCheck size={15} aria-hidden="true" />
                          {formatRole(member.role)}
                        </span>
                      </td>
                      <td data-label="Status">
                        <span
                          className={`${styles.status} ${member.isActive ? styles.statusActive : styles.statusInactive}`}
                        >
                          {member.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className={styles.dateCell} data-label="Date added">
                        {formatDate(member.createdAt)}
                      </td>
                      <td className={styles.actionsCell} data-label="Actions">
                        <button
                          type="button"
                          className={styles.editButton}
                          onClick={() => openEditDialog(member)}
                          aria-label={`Edit ${member.fullName}`}
                          title="Edit staff member"
                        >
                          <Pencil size={15} aria-hidden="true" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!error && !isLoading && filteredStaff.length > 0 && (
            <Pagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalItems={filteredStaff.length}
              itemsPerPage={PAGE_SIZE}
              onPageChange={setCurrentPage}
              isFiltered={hasFilters}
            />
          )}
        </section>
      </div>

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
                <p className={styles.eyebrow}>
                  {mode === "create" ? "New account" : "Account settings"}
                </p>
                <h2 id="staff-dialog-title">
                  {mode === "create" ? "Add staff member" : "Edit staff member"}
                </h2>
                <p className={styles.dialogDescription}>
                  {mode === "create"
                    ? "Create an account and assign a team role."
                    : "Update this team member’s details and access."}
                </p>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={closeDialog}
                aria-label="Close dialog"
                title="Close"
              >
                <X size={19} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={saveStaff} aria-busy={isSaving}>
              <label>
                Full name
                <input
                  required
                  value={form.fullName}
                  maxLength={30}
                  autoComplete="name"
                  onChange={(event) =>
                    updateForm("fullName", event.target.value)
                  }
                />
              </label>
              <label>
                Email address
                <input
                  required
                  type="email"
                  autoComplete="email"
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
                  autoComplete={mode === "create" ? "new-password" : "off"}
                  onChange={(event) =>
                    updateForm("password", event.target.value)
                  }
                />
              </label>
              <label>
                Staff role
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
                    className={styles.deactivateButton}
                    onClick={() => void deactivateStaff()}
                    disabled={isSaving}
                  >
                    <CircleMinus size={16} aria-hidden="true" />
                    Deactivate
                  </button>
                )}
                {mode === "edit" && selectedStaff?.isActive === false && (
                  <button
                    type="button"
                    className={styles.activateButton}
                    onClick={() => void ActivateStaff()}
                    disabled={isSaving}
                  >
                    Activate
                  </button>
                )}
                <span className={styles.actionSpacer} />
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
