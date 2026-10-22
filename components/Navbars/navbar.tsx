
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  ClipboardCheck,
  History,
  CalendarDays,
  Users,
  BedDouble,
  Settings,
  Activity,
  ChartNoAxesColumn,
  Bell,
  Menu,
  X,
  LogOut,
} from "lucide-react";

import { useAuth } from "@/components/Auth/AuthProvider";
import { usePopupMessage } from "@/components/PopupMessage";
import styles from "./navbar.module.css";

const AdminNavigation = [
  { name: "Dashboard", href: "/Pages/Dashboard", icon: LayoutDashboard },
  { name: "Housekeeping review", href: "/Pages/HousekeepingReview", icon: ClipboardCheck },
  { name: "Reservations History", href: "/Pages/Reservations-History", icon: History },
  { name: "Reservations", href: "/Pages/Reservations", icon: CalendarDays },
  { name: "Guests", href: "/Pages/Guests", icon: Users },
  { name: "Rooms setup", href: "/Pages/Rooms", icon: BedDouble },
  { name: "Staff", href: "/Pages/Staff", icon: Users },
  { name: "Hotel settings", href: "/Pages/Settings", icon: Settings },
  { name: "Activity log", href: "/Pages/Activity-Log", icon: Activity },
  { name: "Statistics", href: "/Pages/Statistics", icon: ChartNoAxesColumn },
];

const ManagerNavigation = [
  { name: "Dashboard", href: "/Pages/Dashboard", icon: LayoutDashboard },
  { name: "Housekeeping review", href: "/Pages/HousekeepingReview", icon: ClipboardCheck },
  { name: "Reservations History", href: "/Pages/Reservations-History", icon: History },
  { name: "Reservations", href: "/Pages/Reservations", icon: CalendarDays },
  { name: "Guests", href: "/Pages/Guests", icon: Users },
  { name: "Rooms setup", href: "/Pages/Rooms", icon: BedDouble },
  { name: "Staff", href: "/Pages/Staff", icon: Users },
  { name: "Activity log", href: "/Pages/Activity-Log", icon: Activity },
  { name: "Statistics", href: "/Pages/Statistics", icon: ChartNoAxesColumn },
];

const ReceptionistNavigation = [
  { name: "Dashboard", href: "/Pages/Dashboard", icon: LayoutDashboard },
  { name: "Housekeeping review", href: "/Pages/HousekeepingReview", icon: ClipboardCheck },
  { name: "Reservations History", href: "/Pages/Reservations-History", icon: History },
  { name: "Reservations", href: "/Pages/Reservations", icon: CalendarDays },
  { name: "Guests", href: "/Pages/Guests", icon: Users },
  { name: "Rooms setup", href: "/Pages/Rooms", icon: BedDouble },
];

const HousekeepingNavigation = [
  { name: "Dashboard", href: "/Pages/Dashboard", icon: LayoutDashboard },
  { name: "History", href: "/Pages/Housekeeping-History", icon: History },
  { name: "Notifications", href: "/Pages/Housekeeping-Notifications", icon: Bell },
];

const navigationByRole = {
  ADMIN: AdminNavigation,
  MANAGER: ManagerNavigation,
  RECEPTIONIST: ReceptionistNavigation,
  HOUSEKEEPING: HousekeepingNavigation,
} as const;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { notify } = usePopupMessage();
  const { user, setUser, hotel, hotelLoading } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      const response = await fetch("/api/v1/auth/logout", {
        method: "POST",
        keepalive: true,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload?.message || payload?.error || "Logout failed.",
        );
      }
    } catch (error) {
      notify({
        kind: "error",
        title: "Logout failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setUser(null);
      router.replace("/");
      setIsLoggingOut(false);
    }
  }

  const navigation =
    user?.role && user.role in navigationByRole
      ? navigationByRole[user.role as keyof typeof navigationByRole]
      : [];

  return (
    <>
      <button
        type="button"
        className={`${styles.menuButton} ${isOpen ? styles.menuButtonOpen : ""}`}
        aria-label={isOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={isOpen}
        aria-controls="hotelflow-sidebar"
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? <X size={23} /> : <Menu size={23} />}
      </button>

      {isOpen && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close navigation"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        id="hotelflow-sidebar"
        className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}
      >
        <div className={styles.hotelHeader}>
          <h1>HotelFlow</h1>
          <p>
            {hotel?.name ?? (hotelLoading ? "Loading hotel..." : "")}
            {hotel?.address ? ` · ${hotel.address}` : ""}
          </p>
        </div>

        <nav className={styles.navigation} aria-label="Main navigation">
          {navigation.map((item) => {
            const currentPath = pathname?.replace(/\/+$/, "") || "/";
            const itemPath = item.href.replace(/\/+$/, "") || "/";

            const isActive =
              currentPath === itemPath ||
              currentPath.startsWith(`${itemPath}/`);

            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`${styles.navItem} ${
                  isActive ? styles.active : ""
                }`}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setIsOpen(false)}
              >
                <Icon className={styles.navIcon} size={19} strokeWidth={1.8} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.userSection}>
          <p>Signed in as</p>
          <strong>{user?.fullName ?? "Loading..."}</strong>
        </div>

        <button
          type="button"
          className={styles.logoutButton}
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut size={17} strokeWidth={1.8} />
          <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
        </button>
      </aside>
    </>
  );
}
