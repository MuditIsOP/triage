"use client";

import { create } from "zustand";

type DashboardStore = {
  selectedView: "dashboard" | "patients" | "beds" | "analytics" | "audit-logs" | "settings";
  setSelectedView: (selectedView: DashboardStore["selectedView"]) => void;
};

export const useDashboardStore = create<DashboardStore>((set) => ({
  selectedView: "dashboard",
  setSelectedView: (selectedView) => set({ selectedView }),
}));
