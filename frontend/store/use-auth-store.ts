"use client";

import { Role } from "@er-triage/shared";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ApiClientError, apiFetch } from "@/lib/api-client";

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
};

type LoginPayload = {
  email: string;
  password: string;
};

type AuthStore = {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  logoutMessage: string | null;
  setHydrated: () => void;
  login: (payload: LoginPayload) => Promise<void>;
  logout: (message?: string | null) => void;
  validateSession: () => Promise<void>;
  clearError: () => void;
  clearLogoutMessage: () => void;
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isHydrated: false,
      isLoading: false,
      error: null,
      logoutMessage: null,
      setHydrated: () => set({ isHydrated: true }),
      login: async ({ email, password }) => {
        set({ isLoading: true, error: null, logoutMessage: null });

        try {
          const data = await apiFetch<{
            token: string;
            user: AuthUser;
          }>("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          });

          set({
            token: data.token,
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error instanceof ApiClientError ? error.message : "Login failed",
          });
          throw error;
        }
      },
      logout: (message = null) => {
        const safeMessage = typeof message === "string" || message === null ? message : null;

        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
          logoutMessage: safeMessage,
        });
      },
      validateSession: async () => {
        const { token } = get();

        if (!token) {
          set({
            user: null,
            isAuthenticated: false,
          });
          return;
        }

        set({ isLoading: true });

        try {
          const data = await apiFetch<AuthUser>("/auth/me", { token });

          set({
            user: data,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const message =
            error instanceof ApiClientError
              ? error.message === "System has been reset by administrator"
                ? "System has been reset by administrator"
                : "Session expired or invalid. Please login again."
              : "Session expired or invalid. Please login again.";

          set({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            logoutMessage: message,
          });
        }
      },
      clearError: () => set({ error: null }),
      clearLogoutMessage: () => set({ logoutMessage: null }),
    }),
    {
      name: "er-auth-session",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error && typeof window !== "undefined") {
          window.localStorage.removeItem("er-auth-session");
        }

        state?.setHydrated();
      },
    },
  ),
);
