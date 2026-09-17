"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/Auth/AuthProvider";
import styles from "./navbar.module.css";
import { Bree_Serif } from "next/font/google";

const AdminNavigation = [
  { name: "Dashboard", href:"/Pages/Dashboard" },
  { name: "Housekeeping review", href: "/Pages/HousekeepingReview" },
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
  { name: "Reservations", href: "/Pages/Reservations" },
  { name: "Guests", href: "/Pages/Guests" },
  { name: "Rooms setup", href: "/Pages/Rooms" },
  { name: "Staff", href: "/Pages/Staff" },
  { name: "Activity log", href: "/Pages/Activity-Log" },
];

const ReceptionistNavigation = [
  { name: "Dashboard", href: "/Pages/Dashboard" },
  { name: "Housekeeping review", href: "/Pages/HousekeepingReview" },
  { name: "Reservations", href: "/Pages/Reservations" },
  { name: "Guests", href: "/Pages/Guests" },
  { name: "Rooms setup", href: "/Pages/Rooms" },
];

let Navigation: any[] = [];
export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutError(null);

    try {
      const response = await fetch("/api/v1/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      setUser(null);
      router.replace("/");
    } catch {
      setLogoutError("Unable to log out. Please try again.");
      setIsLoggingOut(false);
    }
  }
  switch (user?.role) {
    case "ADMIN":
      Navigation = AdminNavigation;
      break;
    case "MANAGER":
      Navigation = ManagerNavigation;
      break;
    case "RECEPTIONIST":
      Navigation = ReceptionistNavigation;
      break;
  }
  console.log(Navigation);
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
        <p>Hotel Name - location</p>
      </div>

      <nav className={styles.navigation}>
        {Navigation.map((item) => {
          const isActive = pathname === item.href;

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