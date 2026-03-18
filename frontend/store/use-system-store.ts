"use client";

import { create } from "zustand";
import { ApiClientError, apiFetch } from "@/lib/api-client";

export type DashboardAlert = {
  type: string;
  message: string;
};

const getAlertKey = (alert: DashboardAlert) => `${alert.type}:${alert.message}`;

export type ActivityItem = {
  id: string;
  eventType: string;
  timestamp: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  patient: {
    id: string;
    patientId: string;
    name: string;
  } | null;
  metadata: Record<string, unknown>;
};

export type DashboardOverview = {
  summary: {
    totalActivePatients: number;
    criticalPatients: number;
    urgentPatients: number;
    manualReviewPatients: number;
    demoPatients: number;
  };
  beds: {
    general: {
      total: number;
      occupied: number;
    };
    critical: {
      total: number;
      occupied: number;
    };
  };
  activity: ActivityItem[];
  alerts: DashboardAlert[];
};

export type AuditLogItem = {
  id: string;
  eventType: string;
  timestamp: string;
  oldValue: unknown;
  newValue: unknown;
  metadata: Record<string, unknown>;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  patient: {
    id: string;
    patientId: string;
    name: string;
  } | null;
};

export type NurseUser = {
  id: string;
  name: string;
  email: string;
  isDefaultAccount: boolean;
  createdAt: string;
};

export type AnalyticsItem = {
  patientId: string;
  name: string;
  score: number;
  priority: string;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiClientError ? error.message : fallback;

type SystemStore = {
  overview: DashboardOverview | null;
  auditLogs: AuditLogItem[];
  nurses: NurseUser[];
  analytics: AnalyticsItem[];
  seenAlertKeys: string[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  loadOverview: (token: string) => Promise<void>;
  loadAuditLogs: (token: string, eventType?: string) => Promise<void>;
  loadNurses: (token: string) => Promise<void>;
  createNurse: (token: string, payload: { name: string; email: string; password: string }) => Promise<void>;
  removeNurse: (token: string, nurseId: string) => Promise<void>;
  updateBeds: (token: string, payload: { generalBedCount: number; criticalBedCount: number }) => Promise<void>;
  resetSystem: (token: string, payload: { confirmationText: string; reseedDemoCount: number }) => Promise<{ logout: boolean; message: string }>;
  loadAnalytics: (token: string) => Promise<void>;
  markAlertsSeen: () => void;
  clearError: () => void;
};

export const useSystemStore = create<SystemStore>((set) => ({
  overview: null,
  auditLogs: [],
  nurses: [],
  analytics: [],
  seenAlertKeys: [],
  isLoading: false,
  isSaving: false,
  error: null,
  loadOverview: async (token) => {
    set({ isLoading: true, error: null });
    try {
      const overview = await apiFetch<DashboardOverview>("/system/overview", { token });
      set((state) => ({
        overview,
        isLoading: false,
        seenAlertKeys: state.seenAlertKeys.filter((key) =>
          overview.alerts.some((alert) => getAlertKey(alert) === key),
        ),
      }));
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error, "Unable to load system overview") });
    }
  },
  loadAuditLogs: async (token, eventType) => {
    set({ isLoading: true, error: null });
    try {
      const params = eventType ? `?eventType=${encodeURIComponent(eventType)}` : "";
      const data = await apiFetch<{ logs: AuditLogItem[] }>(`/audit-logs${params}`, { token });
      set({ auditLogs: data.logs, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error, "Unable to load audit logs") });
    }
  },
  loadNurses: async (token) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiFetch<{ nurses: NurseUser[] }>("/users/nurses", { token });
      set({ nurses: data.nurses, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error, "Unable to load nurses") });
    }
  },
  createNurse: async (token, payload) => {
    set({ isSaving: true, error: null });
    try {
      await apiFetch("/users/nurses", {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });
      set({ isSaving: false });
      await useSystemStore.getState().loadNurses(token);
    } catch (error) {
      set({ isSaving: false, error: getErrorMessage(error, "Unable to create nurse") });
      throw error;
    }
  },
  removeNurse: async (token, nurseId) => {
    set({ isSaving: true, error: null });
    try {
      await apiFetch(`/users/nurses/${nurseId}`, {
        method: "DELETE",
        token,
      });
      set({ isSaving: false });
      await useSystemStore.getState().loadNurses(token);
    } catch (error) {
      set({ isSaving: false, error: getErrorMessage(error, "Unable to remove nurse") });
      throw error;
    }
  },
  updateBeds: async (token, payload) => {
    set({ isSaving: true, error: null });
    try {
      await apiFetch("/system/beds", {
        method: "PUT",
        token,
        body: JSON.stringify(payload),
      });
      set({ isSaving: false });
      await useSystemStore.getState().loadOverview(token);
    } catch (error) {
      set({ isSaving: false, error: getErrorMessage(error, "Unable to update bed configuration") });
      throw error;
    }
  },
  resetSystem: async (token, payload) => {
    set({ isSaving: true, error: null });
    try {
      const result = await apiFetch<{ logout: boolean; message: string }>("/system/reset", {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });
      set({ isSaving: false });
      return result;
    } catch (error) {
      set({ isSaving: false, error: getErrorMessage(error, "Unable to reset system") });
      throw error;
    }
  },
  loadAnalytics: async (token) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiFetch<{ patients: AnalyticsItem[] }>("/patients/analytics", { token });
      set({ analytics: data.patients, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error, "Unable to load analytics") });
    }
  },
  markAlertsSeen: () =>
    set((state) => ({
      seenAlertKeys: (state.overview?.alerts ?? []).map(getAlertKey),
    })),
  clearError: () => set({ error: null }),
}));
