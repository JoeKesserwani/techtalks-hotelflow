"use client";

import type { ReactNode } from "react";
import Sidebar from "@/components/Navbars/navbar";
import { useAuth } from "@/components/Auth/AuthProvider";
import styles from "./pages-layout.module.css";

export default function PagesShell({ children }: { children: ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <main className={styles.loading} role="status" aria-live="polite">
        <span className={styles.loadingSpinner} aria-hidden="true" />
        <span>Loading your workspace...</span>
      </main>
    );
  }

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.content}>{children}</div>
    </div>
  );
}