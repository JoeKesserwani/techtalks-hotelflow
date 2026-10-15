"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/components/Auth/AuthProvider";
import styles from "./Header.module.css";

type HeaderProps = {
  title: string;
  subtitle: string;
  userSubtitle?: string;
  children?: ReactNode;
};

export default function Header({
  title,
  subtitle,
  userSubtitle,
  children,
}: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
        {children && <div className={styles.content}>{children}</div>}
      </div>

      <div className={styles.role}>
        <div className={styles.roleInfo}>
          <strong>{user?.fullName}</strong>
          {userSubtitle && <span>{userSubtitle}</span>}
        </div>

        <div className={styles.roleBadge}>{user?.role}</div>
      </div>
    </header>
  );
}
