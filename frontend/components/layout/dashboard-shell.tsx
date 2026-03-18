"use client";

import { useEffect, useMemo } from "react";
import { Role } from "@er-triage/shared";
import { ClipboardList } from "lucide-react";
import { ActivityFeedPanel } from "@/components/dashboard/activity-feed-panel";
import { AddPatientForm } from "@/components/dashboard/add-patient-form";
import { AnalyticsPanel } from "@/components/dashboard/analytics-panel";
import { AuditLogPanel } from "@/components/dashboard/audit-log-panel";
import { BedStatusPanel } from "@/components/dashboard/bed-status-panel";
import { PatientCard } from "@/components/dashboard/patient-card";
import { PatientDetailsPanel } from "@/components/dashboard/patient-details-panel";
import { SettingsPanel } from "@/components/dashboard/settings-panel";
import { SystemSummaryPanel } from "@/components/dashboard/system-summary-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/store/use-auth-store";
import { useDashboardStore } from "@/store/use-dashboard-store";
import { sortPatients, usePatientStore } from "@/store/use-patient-store";
import { useSystemStore } from "@/store/use-system-store";

const QueuePanel = ({ role }: { role: Role }) => {
  const patients = usePatientStore((state) => state.patients);
  const selectedPatientId = usePatientStore((state) => state.selectedPatientId);
  const isLoading = usePatientStore((state) => state.isLoading);
  const search = usePatientStore((state) => state.filters.search);
  const sortBy = usePatientStore((state) => state.filters.sortBy);
  const selectPatient = usePatientStore((state) => state.selectPatient);
  const setSortBy = usePatientStore((state) => state.setSortBy);

  const visiblePatients = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filteredPatients = patients.filter((patient) => {
      if (!normalizedSearch) {
        return true;
      }

      const matchesId = patient.patientId.toLowerCase() === normalizedSearch;
      const matchesName =
        role === Role.Viewer ? false : (patient.name ?? "").toLowerCase().includes(normalizedSearch);

      return matchesId || matchesName;
    });

    return sortPatients(filteredPatients, sortBy);
  }, [patients, role, search, sortBy]);

  useEffect(() => {
    if (!selectedPatientId && visiblePatients[0]) {
      selectPatient(visiblePatients[0].patientId);
      return;
    }

    if (selectedPatientId && !visiblePatients.some((patient) => patient.patientId === selectedPatientId)) {
      selectPatient(visiblePatients[0]?.patientId ?? null);
    }
  }, [selectPatient, selectedPatientId, visiblePatients]);

  return (
    <Card className="flex min-h-[560px] flex-col border-white/40 bg-card/72">
      <CardHeader>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <CardTitle>Patient Queue</CardTitle>
            <CardDescription>
              {role === Role.Viewer
                ? "Viewer-safe queue with switchable sort modes."
                : "Switch between priority, waiting time, score, bed assignment, and name."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary" htmlFor="queue-sort">
              Sort
            </label>
            <select
              id="queue-sort"
              className="h-11 rounded-2xl border border-border bg-card-strong px-4 text-sm text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] outline-none backdrop-blur-glass"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            >
              <option value="priority">Priority</option>
              <option value="waitingTime">Waiting time</option>
              <option value="score">Score</option>
              <option value="bedAssignment">Bed assignment</option>
              {role === Role.Viewer ? null : <option value="name">Name</option>}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-border bg-white/40 px-6 py-12 text-center backdrop-blur-glass">
            <p className="text-base font-medium text-text-primary">Loading patient queue</p>
            <p className="mt-3 text-sm leading-6 text-text-secondary">Refreshing the live ER queue from the backend.</p>
          </div>
        ) : visiblePatients.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white/40 px-6 py-12 text-center backdrop-blur-glass">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/56 text-text-secondary">
              <ClipboardList className="h-5 w-5" />
            </div>
            <p className="mt-4 text-base font-medium text-text-primary">No patients in queue</p>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              {role === Role.Viewer
                ? "The queue will appear here when patients are admitted."
                : "Use Add Patient, Quick Entry, or Demo Generator to populate the queue."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {visiblePatients.map((patient) => (
              <PatientCard
                key={patient.patientId}
                patient={patient}
                role={role}
                isSelected={selectedPatientId === patient.patientId}
                onSelect={() => selectPatient(patient.patientId)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const DashboardShell = ({ role }: { role: Role }) => {
  const token = useAuthStore((state) => state.token);
  const selectedView = useDashboardStore((state) => state.selectedView);
  const selectedPatientId = usePatientStore((state) => state.selectedPatientId);
  const selectedPatient = usePatientStore((state) => state.selectedPatient);
  const loadPatients = usePatientStore((state) => state.loadPatients);
  const loadPatientDetails = usePatientStore((state) => state.loadPatientDetails);
  const overview = useSystemStore((state) => state.overview);
  const loadOverview = useSystemStore((state) => state.loadOverview);

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadPatients(token);
    if (role !== Role.Viewer) {
      void loadOverview(token);
    }
  }, [loadOverview, loadPatients, role, token]);

  useEffect(() => {
    if (!token || !selectedPatientId || role === Role.Viewer) {
      return;
    }

    void loadPatientDetails(token, selectedPatientId);
  }, [loadPatientDetails, role, selectedPatientId, token]);

  if (selectedView === "beds" && role !== Role.Viewer) {
    return (
      <main className="flex-1 overflow-hidden bg-background">
        <div className="px-6 py-6">
          <BedStatusPanel overview={overview} role={role} />
        </div>
      </main>
    );
  }

  if (selectedView === "analytics" && role === Role.Doctor) {
    return (
      <main className="flex-1 overflow-hidden bg-background">
        <div className="px-6 py-6">
          <AnalyticsPanel selectedPatient={selectedPatient} />
        </div>
      </main>
    );
  }

  if (selectedView === "audit-logs" && role === Role.Doctor) {
    return (
      <main className="flex-1 overflow-hidden bg-background">
        <div className="px-6 py-6">
          <AuditLogPanel />
        </div>
      </main>
    );
  }

  if (selectedView === "settings" && role === Role.Doctor) {
    return (
      <main className="flex-1 overflow-hidden bg-background">
        <div className="px-6 py-6">
          <SettingsPanel />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-hidden bg-background">
      <div className="flex h-full flex-col px-6 py-6">
        {role !== Role.Viewer ? (
          <section className="mb-6">
            <AddPatientForm role={role} />
          </section>
        ) : null}
        {role !== Role.Viewer && selectedView === "dashboard" ? (
          <section className="mb-6">
            <SystemSummaryPanel overview={overview} />
          </section>
        ) : null}
        <section
          className={
            role === Role.Viewer
              ? "grid flex-1 gap-6 overflow-hidden"
              : "grid flex-1 gap-6 overflow-hidden lg:grid-cols-[1.4fr_0.9fr]"
          }
        >
          <QueuePanel role={role} />
          {role === Role.Viewer ? null : (
            <div className="space-y-6 overflow-y-auto pr-1">
              <PatientDetailsPanel patient={selectedPatient} role={role} />
              {selectedView === "dashboard" ? (
                <>
                  <BedStatusPanel overview={overview} role={role} />
                  <ActivityFeedPanel overview={overview} />
                </>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  );
};
