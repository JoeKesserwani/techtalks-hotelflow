"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import styles from "./navbar.module.css";

const navigation = [
  { name: "Dashboard", href:"/Pages/Dashboard" },
  { name: "Housekeeping review", href: "/Pages/HousekeepingReview" },
  { name: "Reservations", href: "/Pages/reservations" },
  { name: "Guests", href: "/Pages/guests" },
  { name: "Rooms setup", href: "/Pages/rooms" },
  { name: "Staff", href: "/Pages/staff" },
  { name: "Hotel settings", href: "/Pages/settings" },
  { name: "Activity log", href: "/Pages/activity-log" },
];

const ManagerNavigation = [
  { name: "Dashboard", href: "/Pages/Dashboard" },
  { name: "Housekeeping review", href: "/Pages/HousekeepingReview" },
  { name: "Reservations", href: "/Pages/reservations" },
  { name: "Guests", href: "/Pages/guests" },
  { name: "Rooms setup", href: "/Pages/rooms" },
  { name: "Staff", href: "/Pages/staff" },
  { name: "Activity log", href: "/Pages/activity-log" },
];

const ReceptionistNavigation = [
  { name: "Dashboard", href: "/Pages/Dashboard" },
  { name: "Housekeeping review", href: "/Pages/HousekeepingReview" },
  { name: "Reservations", href: "/Pages/reservations" },
  { name: "Guests", href: "/Pages/guests" },
  { name: "Rooms setup", href: "/Pages/rooms" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

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
        {navigation.map((item) => {
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
        <strong>admin&apos;s name</strong>
      </div>

      </aside>
    </>
  );
}