"use client";

import { LlmStatus, Priority, Role } from "@er-triage/shared";
import { Bot, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type QueuePatient } from "@/store/use-patient-store";

const priorityCardClasses: Record<Priority, string> = {
  [Priority.Critical]: "border-l-priority-critical",
  [Priority.Urgent]: "border-l-priority-urgent",
  [Priority.Normal]: "border-l-priority-normal",
};

const priorityBadgeClasses: Record<Priority, string> = {
  [Priority.Critical]: "bg-priority-critical text-text-inverse",
  [Priority.Urgent]: "bg-priority-urgent text-text-primary",
  [Priority.Normal]: "bg-priority-normal text-text-inverse",
};

const statusBadgeClasses: Record<string, string> = {
  waiting: "bg-background text-text-primary",
  in_treatment: "bg-primary/10 text-primary",
  completed: "bg-priority-normal/10 text-priority-normal",
  discharged: "bg-text-secondary/10 text-text-secondary",
  referred: "bg-priority-urgent/10 text-priority-urgent",
};

const llmStatusLabels: Record<LlmStatus, string> = {
  [LlmStatus.Success]: "AI Active",
  [LlmStatus.Fallback]: "Fallback Mode",
  [LlmStatus.Failed]: "AI Unavailable",
};

const llmStatusClasses: Record<LlmStatus, string> = {
  [LlmStatus.Success]: "bg-ai-active/10 text-ai-active",
  [LlmStatus.Fallback]: "bg-ai-fallback/10 text-ai-fallback",
  [LlmStatus.Failed]: "bg-ai-failed/10 text-ai-failed",
};

const riskFlagLabelMap: Record<string, string> = {
  airway_issue: "Airway",
  breathing_issue: "Breathing",
  circulation_issue: "Circulation",
  neurological_risk: "Neuro",
  external_bleeding: "External bleed",
  internal_bleeding: "Internal bleed",
  trauma: "Trauma",
  cardiac_risk: "Cardiac",
  infection_risk: "Infection",
  shock_risk: "Shock",
};

const formatWaitingTime = (waitingTimeMinutes: number) => {
  if (waitingTimeMinutes < 60) {
    return `${waitingTimeMinutes} min`;
  }

  const hours = Math.floor(waitingTimeMinutes / 60);
  const minutes = waitingTimeMinutes % 60;

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
};

export const PatientCard = ({
  patient,
  role,
  isSelected,
  onSelect,
}: {
  patient: QueuePatient;
  role: Role;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  return (
    <button
      className={cn(
        "group relative h-[228px] w-full overflow-hidden rounded-[24px] border border-white/45 border-l-4 bg-card-strong p-4 text-left shadow-panel backdrop-blur-glass transition-all duration-200 hover:-translate-y-1 hover:bg-hover hover:shadow-float",
        priorityCardClasses[patient.priority],
        isSelected ? "border-primary bg-white/72 ring-2 ring-primary ring-offset-2 shadow-float" : "",
      )}
      onClick={onSelect}
      type="button"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-text-secondary">{patient.patientId}</p>
            {role === Role.Viewer ? (
              <p className="mt-1 line-clamp-1 text-lg font-semibold text-text-primary">Restricted</p>
            ) : (
              <p className="mt-1 line-clamp-1 text-lg font-semibold text-text-primary">{patient.name}</p>
            )}
          </div>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]",
              priorityBadgeClasses[patient.priority],
            )}
          >
            {patient.priority}
          </span>
        </div>

        <div className="mt-4 grid gap-3 text-sm text-text-secondary sm:grid-cols-2">
          {role === Role.Viewer ? null : (
            <span className="rounded-full bg-white/56 px-3 py-1 font-medium text-text-primary">
              Score {patient.score ?? 0}
            </span>
          )}
          <span
            className={cn(
              "rounded-full px-3 py-1 font-medium capitalize",
              statusBadgeClasses[patient.status] ?? "bg-background text-text-primary",
            )}
          >
            {patient.status.replace(/_/g, " ")}
          </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/56 px-3 py-1">
              <Clock3 className="h-4 w-4" />
              {formatWaitingTime(patient.waitingTimeMinutes)}
            </span>
          {role === Role.Viewer ? null : patient.bedLabel ? (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-semibold text-primary">
              Assigned {patient.bedLabel}
            </span>
          ) : (
            <span className="rounded-full border border-dashed border-border px-3 py-1 font-medium text-text-secondary">
              Bed pending
            </span>
          )}
        </div>

        {role === Role.Viewer ? null : (
          <div className="mt-auto space-y-3 pt-4">
            <div className="flex flex-wrap gap-2">
              {patient.manualReviewRequired ? (
                <span className="rounded-full bg-priority-urgent px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-primary">
                  Awaiting Review
                </span>
              ) : null}
              {patient.bedReallocation?.state === "transferring" ? (
                <span className="rounded-full border border-priority-critical bg-priority-critical/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-priority-critical">
                  Transferring
                </span>
              ) : null}
              {patient.bedReallocation?.state === "reassigned" ? (
                <span className="rounded-full border border-priority-urgent bg-priority-urgent/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-primary">
                  Reassigned
                </span>
              ) : null}
              {patient.overrideActive ? (
                <span className="rounded-full border border-primary bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                  Override
                </span>
              ) : null}
              {patient.isDemo ? (
                <span className="rounded-full border border-white/55 bg-white/44 px-3 py-1 text-[11px] font-medium text-text-secondary">
                  Demo
                </span>
              ) : null}
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium",
                  llmStatusClasses[patient.llmStatus ?? LlmStatus.Fallback],
                )}
              >
                <Bot className="h-3.5 w-3.5" />
                {llmStatusLabels[patient.llmStatus ?? LlmStatus.Fallback]}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {(patient.riskFlags ?? []).length === 0 ? (
                <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-text-secondary">
                  No risk flags
                </span>
              ) : (
                (patient.riskFlags ?? []).slice(0, 3).map((flag) => (
                  <span
                    key={`${patient.patientId}-${flag}`}
                    className="rounded-full border border-white/55 bg-white/48 px-3 py-1 text-xs font-medium text-text-primary"
                  >
                    {riskFlagLabelMap[flag] ?? flag.replace(/_/g, " ")}
                  </span>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </button>
  );
};
