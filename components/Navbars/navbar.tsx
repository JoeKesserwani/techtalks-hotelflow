"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/Auth/AuthProvider";
import styles from "./navbar.module.css";

const AdminNavigation = [
  { name: "Dashboard", href: "/Pages/Dashboard" },
  { name: "Housekeeping review", href: "/Pages/HousekeepingReview" },
  { name: "Reservations History", href: "/Pages/Reservations-History" },
  { name: "Reservations", href: "/Pages/Reservations" },
  { name: "Guests", href: "/Pages/Guests" },
  { name: "Rooms setup", href: "/Pages/Rooms" },
  { name: "Staff", href: "/Pages/Staff" },
  { name: "Hotel settings", href: "/Pages/Settings" },
  { name: "Activity log", href: "/Pages/Activity-Log" },
];

const ManagerNavigation = [
  { name: "Dashboard", href: "/Pages/Dashboard" },
  { name: "Housekeeping review", href: "/Pages/HousekeepingReview" },
  { name: "Reservations History", href: "/Pages/Reservations-History" },
  { name: "Reservations", href: "/Pages/Reservations" },
  { name: "Guests", href: "/Pages/Guests" },
  { name: "Rooms setup", href: "/Pages/Rooms" },
  { name: "Staff", href: "/Pages/Staff" },
  { name: "Activity log", href: "/Pages/Activity-Log" },
];

const ReceptionistNavigation = [
  { name: "Dashboard", href: "/Pages/Dashboard" },
  { name: "Housekeeping review", href: "/Pages/HousekeepingReview" },
  { name: "Reservations History", href: "/Pages/Reservations-History" },
  { name: "Reservations", href: "/Pages/Reservations" },
  { name: "Guests", href: "/Pages/Guests" },
  { name: "Rooms setup", href: "/Pages/Rooms" },
];

const HousekeepingNavigation = [
  { name: "Dashboard", href: "/Pages/Dashboard" },
  { name: "History", href: "/Pages/Housekeeping-History" },
  { name: "Notifications", href: "/Pages/Housekeeping-Notifications" },
]

const navigationByRole = {
  ADMIN: AdminNavigation,
  MANAGER: ManagerNavigation,
  RECEPTIONIST: ReceptionistNavigation,
  HOUSEKEEPING: HousekeepingNavigation,
} as const;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser, hotel, hotelLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutError(null);

    fetch("/api/v1/auth/logout", {
      method: "POST",
      keepalive: true,
    }).catch(() => undefined);

    setUser(null);
    router.replace("/");
  }
  const navigation =
    user?.role && user.role in navigationByRole
      ? navigationByRole[user.role as keyof typeof navigationByRole]
      : [];
  return (
    <>
      <button
        type="button"
        className={styles.menuButton}
        aria-label={isOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>

      {isOpen && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close navigation"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}>
        <div className={styles.hotelHeader}>
          <h1>HotelFlow</h1>
          <p>
            {hotel?.name ?? (hotelLoading ? "Loading hotel..." : "")}{" "}
            {hotel?.address ?? (hotelLoading ? "Loading address..." : "")}
          </p>
        </div>

        <nav className={styles.navigation}>
          {navigation.map((item) => {
            const currentPath = pathname?.replace(/\/+$/, "") || "/";
            const itemPath = item.href.replace(/\/+$/, "") || "/";
            const isActive =
              currentPath === itemPath ||
              currentPath.startsWith(`${itemPath}/`);

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.active : ""}`}
                onClick={() => setIsOpen(false)}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className={styles.userSection}>
          <p>Signed in as</p>
          <strong>{user?.fullName ?? "Loading..."}</strong>
          {logoutError && <p>{logoutError}</p>}
        </div>
        <button
          type="button"
          className={styles.logoutButton}
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </aside>
    </>
  );
}
