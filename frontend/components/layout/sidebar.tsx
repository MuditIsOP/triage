import { Role } from "@er-triage/shared";
import {
  Activity,
  BedDouble,
  ClipboardList,
  LayoutDashboard,
  ShieldPlus,
  Settings,
  UsersRound,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "@/store/use-dashboard-store";

const navigationItemsByRole: Record<
  Role,
  Array<{ label: string; value: "dashboard" | "patients" | "beds" | "analytics" | "audit-logs" | "settings"; icon: typeof LayoutDashboard }>
> = {
  [Role.Doctor]: [
    { label: "Dashboard", value: "dashboard", icon: LayoutDashboard },
    { label: "Patients", value: "patients", icon: UsersRound },
    { label: "Beds", value: "beds", icon: BedDouble },
    { label: "Analytics", value: "analytics", icon: Activity },
    { label: "Audit Logs", value: "audit-logs", icon: ClipboardList },
    { label: "Settings", value: "settings", icon: Settings },
  ],
  [Role.Nurse]: [
    { label: "Dashboard", value: "dashboard", icon: LayoutDashboard },
    { label: "Patients", value: "patients", icon: UsersRound },
    { label: "Beds", value: "beds", icon: BedDouble },
  ],
  [Role.Viewer]: [
    { label: "Dashboard", value: "dashboard", icon: LayoutDashboard },
    { label: "Patients", value: "patients", icon: UsersRound },
  ],
};

export const Sidebar = ({ role }: { role: Role }) => {
  const selectedView = useDashboardStore((state) => state.selectedView);
  const setSelectedView = useDashboardStore((state) => state.setSelectedView);

  return (
    <aside className="w-[236px] shrink-0 border-r border-white/30 bg-card/80 px-4 py-6 backdrop-blur-glass">
      <div className="mb-8 px-3">
        <p className="text-xs uppercase tracking-[0.24em] text-primary">ER Triage</p>
        <h1 className="mt-3 text-[24px] font-semibold tracking-[-0.03em] text-text-primary">Command Center</h1>
        <p className="mt-2 text-sm capitalize text-text-secondary">Signed in as {role}.</p>
      </div>

      <Card className="border-white/35 bg-white/38 p-2 shadow-[0_18px_48px_rgba(109,132,176,0.12)]">
        <nav className="space-y-2">
          {navigationItemsByRole[role].map(({ label, value, icon: Icon }) => (
            <button
              key={label}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-medium transition-all duration-200",
                selectedView === value
                  ? "bg-[linear-gradient(180deg,rgba(83,136,255,0.96),rgba(47,109,246,0.96))] text-text-inverse shadow-[0_16px_28px_rgba(47,109,246,0.28)]"
                  : "text-text-secondary hover:-translate-y-0.5 hover:bg-white/60 hover:text-text-primary",
              )}
              type="button"
              onClick={() => setSelectedView(value)}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </Card>

      {role === Role.Doctor ? (
        <div className="mt-8 rounded-2xl border border-white/45 bg-white/42 px-4 py-4 shadow-[0_18px_48px_rgba(109,132,176,0.12)] backdrop-blur-glass">
          <div className="flex items-center gap-3 text-sm font-medium text-text-primary">
            <ShieldPlus className="h-4 w-4 text-primary" />
            Doctor Controls
          </div>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Manage nurses, reset the system, audit events, and bed configuration from the sidebar sections.
          </p>
        </div>
      ) : null}
    </aside>
  );
};
