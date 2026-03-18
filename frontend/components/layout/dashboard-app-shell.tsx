"use client";

import { Role } from "@er-triage/shared";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAuthStore } from "@/store/use-auth-store";

export const DashboardAppShell = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  if (!user) {
    return null;
  }

  const role = user.role as Role;

  return (
    <div className="flex min-h-screen bg-background text-text-primary">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar role={role} email={user.email} onLogout={() => logout()} />
        <DashboardShell role={role} />
      </div>
    </div>
  );
};
