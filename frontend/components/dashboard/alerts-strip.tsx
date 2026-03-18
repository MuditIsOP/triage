"use client";

import { AlertCircle } from "lucide-react";
import { type DashboardAlert } from "@/store/use-system-store";

export const AlertsStrip = ({ alerts }: { alerts: DashboardAlert[] }) => {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 space-y-3">
      {alerts.map((alert, index) => (
        <div
          key={`${alert.type}-${index}`}
          className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-panel"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 text-priority-critical" />
          <div>
            <p className="text-sm font-medium text-text-primary">{alert.message}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-text-secondary">{alert.type.replace(/_/g, " ")}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
