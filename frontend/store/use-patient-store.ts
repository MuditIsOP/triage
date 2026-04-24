"use client";

import { DataSource, LlmStatus, PatientGuidancePromptKey, PatientStatus, Priority, RiskFlag } from "@er-triage/shared";
import { create } from "zustand";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { useSystemStore } from "@/store/use-system-store";

export type QueuePatient = {
  patientId: string;
  priority: Priority;
  status: PatientStatus;
  waitingTimeMinutes: number;
  name?: string;
  score?: number;
  riskFlags?: RiskFlag[];
  topFactor?: string;
  contributors?: string[];
  aiSummary?: string;
  llmStatus?: LlmStatus;
  isDemo?: boolean;
  manualReviewRequired?: boolean;
  overrideActive?: boolean;
  bedLabel?: string | null;
  dataSourceLabel?: "manual" | "simulation";
  bedReallocation?: {
    state: "none" | "reassigned" | "transferring";
    message: string;
    displacedByPatientId: string | null;
    updatedAt: string | null;
  };
};

export type PatientDetails = {
  id: string;
  patientId: string;
  name: string;
  age: number;
  gender: "male" | "female" | "other";
  priority: Priority;
  score: number;
  status: PatientStatus;
  waitingTimeMinutes: number;
  riskFlags: RiskFlag[];
  llmStatus: LlmStatus;
  aiSummary: string;
  aiConfidence: number;
  normalizedSymptoms: string[];
  llmOriginalNormalizedSymptoms: string[];
  nurseConfirmedSymptoms: boolean;
  symptoms: {
    controlled: string[];
    otherText: string;
  };
  vitals: Record<
    "heartRate" | "bloodPressureSystolic" | "bloodPressureDiastolic" | "temperature" | "oxygenSaturation" | "bloodSugar",
    { value: number | null; dataSource: DataSource }
  >;
  injuryIncident: {
    type: string;
    severity: string | null;
    bleeding: boolean;
    unconsciousReported: boolean;
  };
  history: {
    diabetes: boolean;
    hypertension: boolean;
    heartDisease: boolean;
    other: string;
  };
  topFactor: string;
  contributors: string[];
  doctorNotes: string;
  bedAssignment: {
    bedId: string | null;
    bedType: "general" | "critical" | null;
    priorityMismatch: boolean;
  };
  bedReallocation: {
    state: "none" | "reassigned" | "transferring";
    message: string;
    displacedByPatientId: string | null;
    updatedAt: string | null;
  };
  manualReviewRequired: boolean;
  awaitingFullData: boolean;
  isDemo: boolean;
  override: {
    isActive: boolean;
    priority: Priority | null;
    scope: string;
  };
  referral: {
    destination: string;
    reason: string;
  };
  version: number;
  dataSourceLabel: "manual" | "simulation";
  vitalsHistory: Array<{
    recordedAt: string;
    source: "manual" | "simulation" | "system";
    score: number;
    priority: Priority;
    heartRate: number | null;
    bloodPressureSystolic: number | null;
    bloodPressureDiastolic: number | null;
    temperature: number | null;
    oxygenSaturation: number | null;
    bloodSugar: number | null;
  }>;
  auditPreview: Array<{
    id: string;
    eventType: string;
    timestamp: string;
    metadata: Record<string, unknown>;
    oldValue: unknown;
    newValue: unknown;
  }>;
};

export type IntakePreviewResponse = {
  duplicate: {
    detected: boolean;
    patientId?: string;
    message?: string;
  };
  llm: {
    status: LlmStatus;
    normalizedSymptoms: string[];
    riskFlags: RiskFlag[];
    criticalRiskConfidence: number;
    summary: string;
  };
};

export type PatientGuidanceResponse = {
  promptKey: PatientGuidancePromptKey;
  status: LlmStatus;
  heading: string;
  summary: string;
  bullets: string[];
  caution: string;
};

export type QueueSortMode = "priority" | "waitingTime" | "score" | "bedAssignment" | "name";

const priorityRank: Record<Priority, number> = {
  [Priority.Critical]: 3,
  [Priority.Urgent]: 2,
  [Priority.Normal]: 1,
};

export const sortPatients = (patients: QueuePatient[], sortBy: QueueSortMode = "priority") =>
  [...patients].sort((left, right) => {
    if (sortBy === "waitingTime") {
      return right.waitingTimeMinutes - left.waitingTimeMinutes;
    }

    if (sortBy === "score") {
      return (right.score ?? 0) - (left.score ?? 0);
    }

    if (sortBy === "bedAssignment") {
      const leftHasBed = left.bedLabel ? 1 : 0;
      const rightHasBed = right.bedLabel ? 1 : 0;

      if (rightHasBed !== leftHasBed) {
        return rightHasBed - leftHasBed;
      }

      return (left.bedLabel ?? "ZZZ").localeCompare(right.bedLabel ?? "ZZZ");
    }

    if (sortBy === "name") {
      return (left.name ?? "ZZZ").localeCompare(right.name ?? "ZZZ");
    }

    const priorityDelta = priorityRank[right.priority] - priorityRank[left.priority];

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    const rightScore = right.score ?? 0;
    const leftScore = left.score ?? 0;
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    return right.waitingTimeMinutes - left.waitingTimeMinutes;
  });

const upsertQueuePatient = (patients: QueuePatient[], nextPatient: QueuePatient) => {
  const remaining = patients.filter((patient) => patient.patientId !== nextPatient.patientId);
  return sortPatients([nextPatient, ...remaining]);
};

const detailToQueuePatient = (patient: PatientDetails): QueuePatient => ({
  patientId: patient.patientId,
  priority: patient.priority,
  status: patient.status,
  waitingTimeMinutes: patient.waitingTimeMinutes,
  name: patient.name,
  score: patient.score,
  riskFlags: patient.riskFlags,
  topFactor: patient.topFactor,
  contributors: patient.contributors,
  aiSummary: patient.aiSummary,
  llmStatus: patient.llmStatus,
  isDemo: patient.isDemo,
  manualReviewRequired: patient.manualReviewRequired,
  overrideActive: patient.override.isActive,
  bedLabel: patient.bedAssignment.bedId
    ? `${patient.bedAssignment.bedType === "critical" ? "Critical" : "General"} ${patient.bedAssignment.bedId}`
    : null,
  dataSourceLabel: patient.dataSourceLabel,
  bedReallocation: patient.bedReallocation,
});

type PatientStore = {
  patients: QueuePatient[];
  selectedPatientId: string | null;
  selectedPatient: PatientDetails | null;
  isLoading: boolean;
  isLoadingDetails: boolean;
  isSubmitting: boolean;
  isGeneratingDemo: boolean;
  error: string | null;
  filters: {
    search: string;
    sortBy: QueueSortMode;
  };
  selectPatient: (patientId: string | null) => void;
  setSearch: (search: string) => void;
  setSortBy: (sortBy: QueueSortMode) => void;
  loadPatients: (token: string) => Promise<void>;
  loadPatientDetails: (token: string, patientId: string) => Promise<void>;
  previewIntake: (token: string, payload: unknown) => Promise<IntakePreviewResponse>;
  createPatient: (token: string, payload: unknown) => Promise<PatientDetails>;
  createQuickEntryPatient: (token: string, payload: unknown) => Promise<PatientDetails>;
  updatePatient: (token: string, patientId: string, payload: unknown) => Promise<PatientDetails>;
  updatePatientStatus: (token: string, patientId: string, payload: unknown) => Promise<PatientDetails>;
  applyOverride: (token: string, patientId: string, payload: unknown) => Promise<PatientDetails>;
  clearOverride: (token: string, patientId: string, version: number) => Promise<PatientDetails>;
  deletePatient: (token: string, patientId: string) => Promise<void>;
  generateDemoPatients: (token: string, count: number) => Promise<void>;
  requestPatientGuidance: (
    token: string,
    patientId: string,
    promptKey: PatientGuidancePromptKey,
  ) => Promise<PatientGuidanceResponse>;
  clearError: () => void;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiClientError ? error.message : fallback;

const refreshOverviewAfterMutation = async (token: string) => {
  await useSystemStore.getState().loadOverview(token);
};

export const usePatientStore = create<PatientStore>((set, get) => ({
  patients: [],
  selectedPatientId: null,
  selectedPatient: null,
  isLoading: false,
  isLoadingDetails: false,
  isSubmitting: false,
  isGeneratingDemo: false,
  error: null,
  filters: {
    search: "",
    sortBy: "priority",
  },
  selectPatient: (selectedPatientId) => set({ selectedPatientId }),
  setSearch: (search) =>
    set((state) => ({
      filters: {
        ...state.filters,
        search,
      },
    })),
  setSortBy: (sortBy) =>
    set((state) => ({
      filters: {
        ...state.filters,
        sortBy,
      },
    })),
  loadPatients: async (token) => {
    set({ isLoading: true, error: null });

    try {
      const data = await apiFetch<{ patients: QueuePatient[] }>("/patients", { token });
      const sortedPatients = sortPatients(data.patients, get().filters.sortBy);
      const selectedPatientId = get().selectedPatientId ?? sortedPatients[0]?.patientId ?? null;

      set({
        patients: sortedPatients,
        selectedPatientId,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: getErrorMessage(error, "Unable to load patients"),
      });
    }
  },
  loadPatientDetails: async (token, patientId) => {
    set({ isLoadingDetails: true, error: null });

    try {
      const data = await apiFetch<{ patient: PatientDetails }>(`/patients/${patientId}`, { token });
      set({
        selectedPatient: data.patient,
        selectedPatientId: data.patient.patientId,
        isLoadingDetails: false,
      });
    } catch (error) {
      set({
        isLoadingDetails: false,
        error: getErrorMessage(error, "Unable to load patient details"),
      });
    }
  },
  previewIntake: async (token, payload) =>
    apiFetch<IntakePreviewResponse>("/patients/intake/preview", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    }),
  createPatient: async (token, payload) => {
    set({ isSubmitting: true, error: null });
    try {
      const data = await apiFetch<{ patient: PatientDetails }>("/patients", {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });
      set((state) => ({
        patients: sortPatients(
          state.patients
            .filter((patient) => patient.patientId !== data.patient.patientId)
            .concat(detailToQueuePatient(data.patient)),
          state.filters.sortBy,
        ),
        selectedPatient: data.patient,
        selectedPatientId: data.patient.patientId,
        isSubmitting: false,
      }));
      await refreshOverviewAfterMutation(token);
      return data.patient;
    } catch (error) {
      set({ isSubmitting: false, error: getErrorMessage(error, "Unable to create patient") });
      throw error;
    }
  },
  createQuickEntryPatient: async (token, payload) => {
    set({ isSubmitting: true, error: null });
    try {
      const data = await apiFetch<{ patient: PatientDetails }>("/patients/quick-entry", {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });
      set((state) => ({
        patients: sortPatients(
          state.patients
            .filter((patient) => patient.patientId !== data.patient.patientId)
            .concat(detailToQueuePatient(data.patient)),
          state.filters.sortBy,
        ),
        selectedPatient: data.patient,
        selectedPatientId: data.patient.patientId,
        isSubmitting: false,
      }));
      await refreshOverviewAfterMutation(token);
      return data.patient;
    } catch (error) {
      set({ isSubmitting: false, error: getErrorMessage(error, "Unable to create quick entry patient") });
      throw error;
    }
  },
  updatePatient: async (token, patientId, payload) => {
    set({ isSubmitting: true, error: null });
    try {
      const data = await apiFetch<{ patient: PatientDetails }>(`/patients/${patientId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      });
      set((state) => ({
        patients: sortPatients(
          state.patients
            .filter((patient) => patient.patientId !== data.patient.patientId)
            .concat(detailToQueuePatient(data.patient)),
          state.filters.sortBy,
        ),
        selectedPatient: data.patient,
        selectedPatientId: data.patient.patientId,
        isSubmitting: false,
      }));
      await refreshOverviewAfterMutation(token);
      return data.patient;
    } catch (error) {
      set({ isSubmitting: false, error: getErrorMessage(error, "Unable to update patient") });
      throw error;
    }
  },
  updatePatientStatus: async (token, patientId, payload) => {
    set({ isSubmitting: true, error: null });
    try {
      const data = await apiFetch<{ patient: PatientDetails }>(`/patients/${patientId}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      });
      set((state) => ({
        patients: sortPatients(
          state.patients
            .filter((patient) => patient.patientId !== data.patient.patientId)
            .concat(detailToQueuePatient(data.patient)),
          state.filters.sortBy,
        ),
        selectedPatient: data.patient,
        selectedPatientId: data.patient.patientId,
        isSubmitting: false,
      }));
      await refreshOverviewAfterMutation(token);
      return data.patient;
    } catch (error) {
      set({ isSubmitting: false, error: getErrorMessage(error, "Unable to update patient status") });
      throw error;
    }
  },
  applyOverride: async (token, patientId, payload) => {
    set({ isSubmitting: true, error: null });
    try {
      const data = await apiFetch<{ patient: PatientDetails }>(`/patients/${patientId}/override`, {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      });
      set((state) => ({
        patients: sortPatients(
          state.patients
            .filter((patient) => patient.patientId !== data.patient.patientId)
            .concat(detailToQueuePatient(data.patient)),
          state.filters.sortBy,
        ),
        selectedPatient: data.patient,
        selectedPatientId: data.patient.patientId,
        isSubmitting: false,
      }));
      await refreshOverviewAfterMutation(token);
      return data.patient;
    } catch (error) {
      set({ isSubmitting: false, error: getErrorMessage(error, "Unable to apply override") });
      throw error;
    }
  },
  clearOverride: async (token, patientId, version) => {
    set({ isSubmitting: true, error: null });
    try {
      const data = await apiFetch<{ patient: PatientDetails }>(`/patients/${patientId}/override`, {
        method: "DELETE",
        token,
        body: JSON.stringify({ version }),
      });
      set((state) => ({
        patients: upsertQueuePatient(state.patients, detailToQueuePatient(data.patient)),
        selectedPatient: data.patient,
        selectedPatientId: data.patient.patientId,
        isSubmitting: false,
      }));
      await refreshOverviewAfterMutation(token);
      return data.patient;
    } catch (error) {
      set({ isSubmitting: false, error: getErrorMessage(error, "Unable to clear override") });
      throw error;
    }
  },
  deletePatient: async (token, patientId) => {
    set({ isSubmitting: true, error: null });
    try {
      await apiFetch<{ deletedPatientId: string }>(`/patients/${patientId}`, {
        method: "DELETE",
        token,
      });
      set((state) => {
        const remainingPatients = state.patients.filter((patient) => patient.patientId !== patientId);
        const nextSelectedPatientId =
          state.selectedPatientId === patientId ? remainingPatients[0]?.patientId ?? null : state.selectedPatientId;

        return {
          patients: sortPatients(remainingPatients, state.filters.sortBy),
          selectedPatientId: nextSelectedPatientId,
          selectedPatient:
            state.selectedPatient?.patientId === patientId ? null : state.selectedPatient,
          isSubmitting: false,
        };
      });
      await refreshOverviewAfterMutation(token);
    } catch (error) {
      set({ isSubmitting: false, error: getErrorMessage(error, "Unable to delete patient") });
      throw error;
    }
  },
  generateDemoPatients: async (token, count) => {
    set({ isGeneratingDemo: true, error: null });
    try {
      const data = await apiFetch<{ patients: QueuePatient[] }>("/patients/demo", {
        method: "POST",
        token,
        body: JSON.stringify({ count }),
      });
      set((state) => ({
        patients: sortPatients(
          [...data.patients, ...state.patients].filter(
            (patient, index, list) => list.findIndex((entry) => entry.patientId === patient.patientId) === index,
          ),
          state.filters.sortBy,
        ),
        selectedPatientId: data.patients[0]?.patientId ?? state.selectedPatientId,
        isGeneratingDemo: false,
      }));
      await refreshOverviewAfterMutation(token);
    } catch (error) {
      set({ isGeneratingDemo: false, error: getErrorMessage(error, "Unable to generate demo patients") });
      throw error;
    }
  },
  requestPatientGuidance: async (token, patientId, promptKey) => {
    try {
      const data = await apiFetch<{ guidance: PatientGuidanceResponse }>(`/patients/${patientId}/guidance`, {
        method: "POST",
        token,
        body: JSON.stringify({ promptKey }),
      });
      return data.guidance;
    } catch (error) {
      set({ error: getErrorMessage(error, "Unable to generate patient guidance") });
      throw error;
    }
  },
  clearError: () => set({ error: null }),
}));
