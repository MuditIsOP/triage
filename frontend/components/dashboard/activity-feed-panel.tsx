"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type DashboardOverview } from "@/store/use-system-store";

export const ActivityFeedPanel = ({ overview }: { overview: DashboardOverview | null }) => {
  if (!overview) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Feed</CardTitle>
        <CardDescription>Recent system activity derived from immutable audit events.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {overview.activity.map((entry) => (
          <div key={entry.id} className="rounded-xl border border-border bg-background px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
              {entry.eventType.replace(/_/g, " ")}
            </p>
            <p className="mt-2 text-sm text-text-primary">
              {entry.patient?.patientId ? `${entry.patient.patientId} · ` : ""}
              {entry.user?.name ? `${entry.user.name} · ` : ""}
              {new Date(entry.timestamp).toLocaleString()}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
