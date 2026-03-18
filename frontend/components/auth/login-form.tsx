"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/use-auth-store";

export const LoginForm = () => {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const logoutMessage = useAuthStore((state) => state.logoutMessage);
  const clearError = useAuthStore((state) => state.clearError);
  const clearLogoutMessage = useAuthStore((state) => state.clearLogoutMessage);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    clearLogoutMessage();

    try {
      await login({ email, password });
      router.replace("/dashboard");
    } catch {
      return;
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-text-inverse">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <CardTitle>Login</CardTitle>
        <CardDescription>
          Access the emergency room command center with your role-based account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="doctor@er.com"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          {error ? (
            <div className="rounded-xl border border-priority-critical bg-background px-3 py-3 text-sm text-priority-critical">
              {error}
            </div>
          ) : null}
          {logoutMessage ? (
            <div className="rounded-xl border border-priority-urgent bg-background px-3 py-3 text-sm text-priority-urgent">
              {logoutMessage}
            </div>
          ) : null}
          <Button className="w-full justify-center" type="submit" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Login"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
