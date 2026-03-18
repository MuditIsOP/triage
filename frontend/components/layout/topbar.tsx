import { Role } from "@er-triage/shared";
import { Bell, LogOut, Search, ShieldPlus, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePatientStore } from "@/store/use-patient-store";
import { useSystemStore } from "@/store/use-system-store";

export const Topbar = ({
  role,
  email,
  onLogout,
}: {
  role: Role;
  email: string;
  onLogout: () => void;
}) => {
  const search = usePatientStore((state) => state.filters.search);
  const setSearch = usePatientStore((state) => state.setSearch);
  const overview = useSystemStore((state) => state.overview);
  const seenAlertKeys = useSystemStore((state) => state.seenAlertKeys);
  const markAlertsSeen = useSystemStore((state) => state.markAlertsSeen);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const alerts = overview?.alerts ?? [];

  const unreadAlerts = useMemo(
    () => alerts.filter((alert) => !seenAlertKeys.includes(`${alert.type}:${alert.message}`)),
    [alerts, seenAlertKeys],
  );

  return (
    <header className="relative z-[120] flex flex-col gap-4 border-b border-white/30 bg-card/70 px-6 py-5 backdrop-blur-glass lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-primary">Hospital Dashboard</p>
        <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-text-primary">
          Emergency Room Triage & Management
        </h2>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-[280px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <Input
            className="pl-9"
            placeholder={role === Role.Viewer ? "Search by patient ID" : "Search by patient ID or name"}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="relative z-[130]">
          <Button
            variant="secondary"
            className="gap-2"
            onClick={() => {
              const nextOpen = !isNotificationsOpen;
              setIsNotificationsOpen(nextOpen);
              if (nextOpen) {
                markAlertsSeen();
              }
            }}
          >
            <span className="relative inline-flex">
              <Bell className="h-4 w-4" />
              {unreadAlerts.length > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full bg-priority-critical" />
              ) : null}
            </span>
            Notifications
          </Button>
          {isNotificationsOpen ? (
            <div className="absolute right-0 top-full z-[200] mt-3 w-[360px] rounded-[28px] border border-white/40 bg-card-strong p-4 shadow-float backdrop-blur-glass">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-text-primary">Notifications</p>
                <span className="text-xs uppercase tracking-[0.14em] text-text-secondary">
                  {alerts.length} total
                </span>
              </div>
              <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto pr-1">
                {alerts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-white/45 px-4 py-6 text-sm text-text-secondary">
                    No active notifications.
                  </div>
                ) : (
                  alerts.map((alert, index) => (
                    <div
                      key={`${alert.type}-${index}`}
                      className="rounded-2xl border border-white/45 bg-white/48 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                    >
                      <p className="text-sm font-medium text-text-primary">{alert.message}</p>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-text-secondary">
                        {alert.type.replace(/_/g, " ")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
        <Button variant="secondary" className="gap-2">
          <ShieldPlus className="h-4 w-4" />
          {role}
        </Button>
        <Button variant="secondary" className="gap-2">
          <UserRound className="h-4 w-4" />
          {email}
        </Button>
        <Button variant="secondary" className="gap-2" onClick={onLogout}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  );
};
