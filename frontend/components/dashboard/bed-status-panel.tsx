"use client";

import { useEffect, useMemo, useState } from "react";
import { Role } from "@er-triage/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/store/use-auth-store";
import { usePatientStore } from "@/store/use-patient-store";
import { type DashboardOverview, useSystemStore } from "@/store/use-system-store";

export const BedStatusPanel = ({
  overview,
  role,
}: {
  overview: DashboardOverview | null;
  role: Role;
}) => {
  const token = useAuthStore((state) => state.token);
  const updateBeds = useSystemStore((state) => state.updateBeds);
  const isSaving = useSystemStore((state) => state.isSaving);
  const patients = usePatientStore((state) => state.patients);
  const [generalBedCount, setGeneralBedCount] = useState(0);
  const [criticalBedCount, setCriticalBedCount] = useState(0);

  useEffect(() => {
    if (!overview) {
      return;
    }

    setGeneralBedCount(overview.beds.general.total);
    setCriticalBedCount(overview.beds.critical.total);
  }, [overview]);

  const tiles = useMemo(() => {
    if (!overview) {
      return [];
    }

    const assignments = new Map(
      patients
        .filter((patient) => patient.bedLabel)
        .map((patient) => {
          const parts = (patient.bedLabel ?? "").split(" ");
          const bedId = parts[parts.length - 1];
          return [
            bedId,
            {
              patientId: patient.patientId,
              name: patient.name ?? "Restricted",
              priority: patient.priority,
              status: patient.status,
              score: patient.score,
            },
          ] as const;
        }),
    );

    const buildTiles = (type: "general" | "critical", total: number, occupied: number) =>
      Array.from({ length: total }, (_, index) => ({
        id: `${type === "critical" ? "C" : "G"}-${String(index + 1).padStart(2, "0")}`,
        occupied: index < occupied || assignments.has(`${type === "critical" ? "C" : "G"}-${String(index + 1).padStart(2, "0")}`),
        type,
        assignment: assignments.get(`${type === "critical" ? "C" : "G"}-${String(index + 1).padStart(2, "0")}`),
      }));

    return [
      ...buildTiles("critical", overview.beds.critical.total, overview.beds.critical.occupied),
      ...buildTiles("general", overview.beds.general.total, overview.beds.general.occupied),
    ];
  }, [overview, patients]);

  const maxBedCount = Math.max(50, overview?.beds.general.total ?? 0, overview?.beds.critical.total ?? 0);

  return (
    <Card className="border-white/45 bg-card/72">
      <CardHeader>
        <CardTitle>Bed Status</CardTitle>
        <CardDescription>Critical beds are prioritized first. General beds absorb overflow when available.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 overflow-visible">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {tiles.map((tile) => (
            <div
              key={tile.id}
              className="group relative overflow-visible"
            >
              <div
                className={`relative h-28 overflow-hidden rounded-[24px] border px-3 py-4 text-center text-xs font-semibold uppercase tracking-[0.12em] shadow-panel backdrop-blur-glass transition-all duration-200 ${
                  tile.type === "critical"
                    ? tile.assignment
                      ? "border-priority-critical/35 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(255,77,87,0.16))] text-priority-critical hover:-translate-y-1 hover:shadow-float"
                      : "border-priority-critical/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.68),rgba(255,77,87,0.08))] text-priority-critical hover:-translate-y-1 hover:shadow-float"
                    : tile.assignment
                      ? "border-primary/30 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(47,109,246,0.16))] text-primary hover:-translate-y-1 hover:shadow-float"
                      : "border-priority-normal/30 bg-[linear-gradient(180deg,rgba(255,255,255,0.68),rgba(38,196,111,0.1))] text-priority-normal hover:-translate-y-1 hover:shadow-float"
                }`}
              >
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.34),transparent_42%)] opacity-90" />
                <p>{tile.type === "critical" ? "CRT" : "GEN"}</p>
                <p className="mt-2">{tile.id.split("-")[1]}</p>
                {tile.assignment ? (
                  <>
                    <p className="mt-3 text-[10px] font-semibold tracking-[0.1em] text-text-primary">
                      {tile.assignment.patientId}
                    </p>
                    <p className="mt-1 text-[10px] font-medium normal-case tracking-normal text-text-secondary">
                      Assigned
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-[10px] font-medium normal-case tracking-normal text-text-secondary">
                    Available
                  </p>
                )}
              </div>

              {tile.assignment ? (
                <div
                  className={`pointer-events-none absolute left-1/2 top-1/2 z-[90] w-60 -translate-x-1/2 -translate-y-[54%] rounded-[28px] border p-4 text-left normal-case tracking-normal text-text-primary opacity-0 shadow-float backdrop-blur-md transition-all duration-200 group-hover:opacity-100 group-hover:[transform:translate(-50%,-54%)_scale(1.02)] ${
                    tile.type === "critical"
                      ? "border-priority-critical/30 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,241,243,0.94))]"
                      : "border-primary/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,246,255,0.94))]"
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    {tile.type === "critical" ? "Critical" : "General"} Bed {tile.id.split("-")[1]}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-text-primary">{tile.assignment.name}</p>
                  <p className="mt-1 text-xs font-medium text-text-secondary">{tile.assignment.patientId}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                        tile.assignment.priority === "critical"
                          ? "border-priority-critical/25 bg-priority-critical/10 text-priority-critical"
                          : tile.assignment.priority === "urgent"
                            ? "border-priority-urgent/25 bg-priority-urgent/12 text-text-primary"
                            : "border-priority-normal/25 bg-priority-normal/10 text-priority-normal"
                      }`}
                    >
                      {tile.assignment.priority}
                    </span>
                    <span className="rounded-full border border-slate-200/70 bg-white/90 px-2.5 py-1 text-[10px] font-medium text-text-secondary">
                      {tile.assignment.status.replace(/_/g, " ")}
                    </span>
                    <span className="rounded-full border border-slate-200/70 bg-white/90 px-2.5 py-1 text-[10px] font-medium text-text-secondary">
                      Score {tile.assignment.score ?? 0}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {role === Role.Doctor && overview ? (
          <div className="grid gap-4 rounded-[24px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.62),rgba(255,255,255,0.38))] px-4 py-4 shadow-panel backdrop-blur-glass">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-[22px] border border-white/45 bg-white/44 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">General Beds</p>
                    <p className="mt-1 text-sm text-text-secondary">Adjust total general-capacity beds.</p>
                  </div>
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                    {generalBedCount}
                  </span>
                </div>
                <input
                  className="glass-range mt-4 w-full cursor-pointer"
                  type="range"
                  min={0}
                  max={maxBedCount}
                  value={generalBedCount}
                  onChange={(event) => setGeneralBedCount(Number(event.target.value))}
                />
                <div className="mt-3 flex items-center justify-between text-xs font-medium text-text-secondary">
                  <span>0</span>
                  <span>{generalBedCount}</span>
                  <span>{maxBedCount}</span>
                </div>
              </div>

              <div className="rounded-[22px] border border-white/45 bg-white/44 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Critical Beds</p>
                    <p className="mt-1 text-sm text-text-secondary">Reserve critical-care bed capacity.</p>
                  </div>
                  <span className="rounded-full border border-priority-critical/20 bg-priority-critical/10 px-3 py-1 text-sm font-semibold text-priority-critical">
                    {criticalBedCount}
                  </span>
                </div>
                <input
                  className="glass-range glass-range--critical mt-4 w-full cursor-pointer"
                  type="range"
                  min={0}
                  max={maxBedCount}
                  value={criticalBedCount}
                  onChange={(event) => setCriticalBedCount(Number(event.target.value))}
                />
                <div className="mt-3 flex items-center justify-between text-xs font-medium text-text-secondary">
                  <span>0</span>
                  <span>{criticalBedCount}</span>
                  <span>{maxBedCount}</span>
                </div>
              </div>
            </div>
            <Button
              className="justify-center xl:max-w-[240px]"
              variant="secondary"
              disabled={isSaving}
              onClick={async () => {
                if (!token) {
                  return;
                }

                await updateBeds(token, {
                  generalBedCount,
                  criticalBedCount,
                });
              }}
            >
              {isSaving ? "Saving..." : "Update Bed Count"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
