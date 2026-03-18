"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/store/use-auth-store";
import { useSystemStore } from "@/store/use-system-store";

export const AuditLogPanel = () => {
  const token = useAuthStore((state) => state.token);
  const auditLogs = useSystemStore((state) => state.auditLogs);
  const loadAuditLogs = useSystemStore((state) => state.loadAuditLogs);
  const isLoading = useSystemStore((state) => state.isLoading);
  const [eventType, setEventType] = useState("");

  useEffect(() => {
    if (token) {
      void loadAuditLogs(token);
    }
  }, [loadAuditLogs, token]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Logs</CardTitle>
        <CardDescription>Doctor-only immutable event history.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <input
            className="flex h-10 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-secondary focus:border-primary"
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
            placeholder="Filter by event type"
          />
          <Button
            variant="secondary"
            onClick={() => {
              if (token) {
                void loadAuditLogs(token, eventType || undefined);
              }
            }}
          >
            Filter
          </Button>
        </div>
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-text-secondary">Loading audit log...</p>
          ) : (
            auditLogs.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-border bg-background px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
                    {entry.eventType.replace(/_/g, " ")}
                  </p>
                  <p className="text-sm text-text-secondary">{new Date(entry.timestamp).toLocaleString()}</p>
                </div>
                <p className="mt-3 text-sm text-text-primary">
                  {entry.patient?.patientId ? `${entry.patient.patientId} · ` : ""}
                  {entry.user?.name ? entry.user.name : "System"}
                </p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
