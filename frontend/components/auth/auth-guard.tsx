"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/store/use-auth-store";

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const logoutMessage = useAuthStore((state) => state.logoutMessage);
  const clearLogoutMessage = useAuthStore((state) => state.clearLogoutMessage);

  useEffect(() => {
    if (!isHydrated || isLoading) {
      return;
    }

    if (!isAuthenticated && pathname !== "/login") {
      router.replace("/login");
    }

    if (isAuthenticated && pathname === "/login") {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isHydrated, isLoading, pathname, router]);

  useEffect(() => {
    if (pathname === "/login") {
      return;
    }

    clearLogoutMessage();
  }, [clearLogoutMessage, pathname]);

  if (!isHydrated || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center text-sm text-text-secondary">
            Checking session status...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated && pathname !== "/login") {
    return null;
  }

  if (isAuthenticated && pathname === "/login") {
    return null;
  }

  return <>{children}</>;
};
