"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/use-auth-store";

export const SessionBoundary = ({ children }: { children: React.ReactNode }) => {
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const validateSession = useAuthStore((state) => state.validateSession);
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (isHydrated && token) {
      void validateSession();
    }
  }, [isHydrated, token, validateSession]);

  useEffect(() => {
    if (!isHydrated || !token) {
      return;
    }

    const interval = window.setInterval(() => {
      void validateSession();
    }, 60000);

    return () => window.clearInterval(interval);
  }, [isHydrated, token, validateSession]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleUnauthorized = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      const message = customEvent.detail?.message;

      if (message === "System has been reset by administrator") {
        logout("System has been reset by administrator");
        return;
      }

      logout("Session expired or invalid. Please login again.");
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized as EventListener);

    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized as EventListener);
  }, [logout]);

  return <>{children}</>;
};
