"use client";

import { useEffect, useMemo, useState } from "react";
import { LlmStatus, PatientGuidancePromptKey } from "@er-triage/shared";
import { Bot, Sparkles, X } from "lucide-react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { type PatientDetails, type PatientGuidanceResponse, usePatientStore } from "@/store/use-patient-store";
import { useAuthStore } from "@/store/use-auth-store";

const PROMPT_OPTIONS: Array<{ key: PatientGuidancePromptKey; label: string; description: string }> = [
  {
    key: PatientGuidancePromptKey.PredictedProblem,
    label: "Predicted Problem",
    description: "Most likely clinical problem suggested by this patient record.",
  },
  {
    key: PatientGuidancePromptKey.CarePriorities,
    label: "Care Priorities",
    description: "Immediate ER priorities and stabilization focus.",
  },
  {
    key: PatientGuidancePromptKey.DosAndDonts,
    label: "Do's and Don'ts",
    description: "Helpful actions and actions to avoid for this patient.",
  },
  {
    key: PatientGuidancePromptKey.MonitoringFocus,
    label: "Monitoring Focus",
    description: "What the team should watch closely for deterioration.",
  },
  {
    key: PatientGuidancePromptKey.HandoffSummary,
    label: "Handoff Summary",
    description: "Short clinician-to-clinician summary for the next handoff.",
  },
];

const STATUS_STYLES: Record<LlmStatus, string> = {
  [LlmStatus.Success]: "border-ai-active/25 bg-ai-active/10 text-ai-active",
  [LlmStatus.Fallback]: "border-ai-fallback/25 bg-ai-fallback/10 text-text-primary",
  [LlmStatus.Failed]: "border-ai-failed/25 bg-ai-failed/10 text-ai-failed",
};

export const PatientGuidanceAssistant = ({
  patient,
  isOpen,
  onClose,
}: {
  patient: PatientDetails;
  isOpen: boolean;
  onClose: () => void;
}) => {
  const token = useAuthStore((state) => state.token);
  const requestPatientGuidance = usePatientStore((state) => state.requestPatientGuidance);
  const [mounted, setMounted] = useState(false);
  const [activePromptKey, setActivePromptKey] = useState<PatientGuidancePromptKey>(
    PatientGuidancePromptKey.PredictedProblem,
  );
  const [guidanceResponse, setGuidanceResponse] = useState<PatientGuidanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const activePrompt = useMemo(
    () => PROMPT_OPTIONS.find((option) => option.key === activePromptKey) ?? PROMPT_OPTIONS[0],
    [activePromptKey],
  );

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !mounted) {
    return null;
  }

  const handlePromptClick = async (promptKey: PatientGuidancePromptKey) => {
    if (!token) {
      return;
    }

    setActivePromptKey(promptKey);
    setIsLoading(true);

    try {
      const guidance = await requestPatientGuidance(token, patient.patientId, promptKey);
      setGuidanceResponse(guidance);
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-[rgba(15,23,42,0.28)] px-4 py-4 backdrop-blur-md sm:px-6 sm:py-6">
      <div className="relative flex h-[92vh] w-[96vw] max-w-[1480px] flex-col overflow-hidden rounded-[36px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(255,255,255,0.62))] shadow-float backdrop-blur-glass xl:flex-row">
        <div className="w-full border-b border-white/35 p-6 xl:w-[360px] xl:shrink-0 xl:border-b-0 xl:border-r">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Patient AI Guide</p>
              <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-text-primary">
                {patient.name}
              </h3>
              <p className="mt-2 text-sm text-text-secondary">
                {patient.patientId} · {patient.priority} · {patient.status.replace(/_/g, " ")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/45 bg-white/50 text-text-secondary transition-all duration-200 hover:bg-white/80 hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 grid gap-3 xl:max-h-[calc(92vh-152px)] xl:overflow-y-auto xl:pr-1">
            {PROMPT_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => void handlePromptClick(option.key)}
                disabled={isLoading}
                className={`w-full rounded-[24px] border px-4 py-4 text-left transition-all duration-200 ${
                  activePromptKey === option.key
                    ? "border-primary/30 bg-primary/10 shadow-panel"
                    : "border-white/45 bg-white/44 hover:bg-white/68"
                }`}
              >
                <p className="text-sm font-semibold text-text-primary">{option.label}</p>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{option.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">{activePrompt.label}</p>
              <p className="text-sm text-text-secondary">{activePrompt.description}</p>
            </div>
          </div>

          <div className="mt-6 flex-1 overflow-y-auto rounded-[30px] border border-white/45 bg-white/42 p-5 backdrop-blur-glass sm:p-6">
            {isLoading ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <Bot className="h-5 w-5 animate-pulse" />
                </div>
                <p className="mt-4 text-base font-semibold text-text-primary">Generating patient-specific guidance</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-text-secondary">
                  Reviewing symptoms, vitals, history, triage score, AI summary, and clinical notes for this patient.
                </p>
              </div>
            ) : guidanceResponse ? (
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${STATUS_STYLES[guidanceResponse.status]}`}
                  >
                    {guidanceResponse.status}
                  </span>
                  <span className="rounded-full border border-white/50 bg-white/52 px-3 py-1 text-xs font-medium text-text-secondary">
                    Structured patient guidance
                  </span>
                </div>

                <h4 className="mt-5 text-[24px] font-semibold tracking-[-0.03em] text-text-primary">
                  {guidanceResponse.heading}
                </h4>
                <p className="mt-4 text-sm leading-7 text-text-secondary">{guidanceResponse.summary}</p>

                <div className="mt-6 space-y-3">
                  {guidanceResponse.bullets.map((bullet, index) => (
                    <div
                      key={`${guidanceResponse.promptKey}-${index}`}
                      className="rounded-2xl border border-white/45 bg-white/48 px-4 py-3"
                    >
                      <p className="text-sm leading-6 text-text-primary">{bullet}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-[24px] border border-priority-urgent/20 bg-priority-urgent/10 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-primary">Clinical caution</p>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">{guidanceResponse.caution}</p>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/45 bg-white/52 text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <p className="mt-4 text-base font-semibold text-text-primary">Choose a guided question</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-text-secondary">
                  This is a patient-specific AI guide, not a free-text chat. Select one of the fixed clinical guidance actions on the left.
                </p>
              </div>
            )}
          </div>

          <div className="mt-5 flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close Guide
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
