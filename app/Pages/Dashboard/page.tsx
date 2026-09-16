"use client";

import React from "react";
import { useAuth } from "@/components/Auth/AuthProvider";
import ManagerDash from "@/components/Dashboards/ManagerDash";
import ReceptionistDash from "@/components/Dashboards/ReceptionistDash";
import HouseKeepingDash from "@/components/Dashboards/HouseKeepingDash";

const dashboardByRole = {
  MANAGER: ManagerDash,
  RECEPTIONIST: ReceptionistDash,
  HOUSEKEEPING: HouseKeepingDash,
} as const;

const DashboardPage = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading dashboard...</div>;
  }

  const DashboardComponent =
    user && user.role in dashboardByRole
      ? dashboardByRole[user.role as keyof typeof dashboardByRole]
      : ManagerDash;

  return <DashboardComponent />;
};

export default DashboardPage;
