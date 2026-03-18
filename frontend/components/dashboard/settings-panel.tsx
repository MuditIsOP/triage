"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/use-auth-store";
import { useSystemStore } from "@/store/use-system-store";

export const SettingsPanel = () => {
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const nurses = useSystemStore((state) => state.nurses);
  const loadNurses = useSystemStore((state) => state.loadNurses);
  const createNurse = useSystemStore((state) => state.createNurse);
  const removeNurse = useSystemStore((state) => state.removeNurse);
  const resetSystem = useSystemStore((state) => state.resetSystem);
  const isSaving = useSystemStore((state) => state.isSaving);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [reseedDemoCount, setReseedDemoCount] = useState("0");

  useEffect(() => {
    if (token) {
      void loadNurses(token);
    }
  }, [loadNurses, token]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Nurse Management</CardTitle>
          <CardDescription>Create and remove nurse accounts with audit coverage.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nurse name" />
            <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Nurse email" />
            <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Temporary password" />
            <Button
              onClick={async () => {
                if (!token) {
                  return;
                }

                await createNurse(token, { name, email, password });
                setName("");
                setEmail("");
                setPassword("");
              }}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Create Nurse"}
            </Button>
          </div>
          <div className="space-y-3">
            {nurses.map((nurse) => (
              <div key={nurse.id} className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">{nurse.name}</p>
                  <p className="text-sm text-text-secondary">{nurse.email}</p>
                </div>
                <Button
                  variant="secondary"
                  disabled={isSaving || nurse.isDefaultAccount}
                  onClick={() => {
                    if (token) {
                      void removeNurse(token, nurse.id);
                    }
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reset System</CardTitle>
          <CardDescription>Typed confirmation is required. Audit history is preserved.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary" htmlFor="reset-confirmation">
              Confirmation
            </label>
            <Input
              id="reset-confirmation"
              value={confirmationText}
              onChange={(event) => setConfirmationText(event.target.value)}
              placeholder="Type RESET"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium text-text-primary" htmlFor="reset-reseed-count">
                Demo Patients To Reseed
              </label>
              <span className="rounded-full border border-border bg-white/44 px-3 py-1 text-xs font-semibold text-text-secondary">
                {reseedDemoCount}
              </span>
            </div>
            <Input
              id="reset-reseed-count"
              value={reseedDemoCount}
              onChange={(event) => setReseedDemoCount(event.target.value)}
              type="number"
              min={0}
              max={20}
              placeholder="0"
            />
            <p className="text-xs leading-5 text-text-secondary">
              Set to <span className="font-semibold text-text-primary">0</span> to reset without creating fresh demo patients.
            </p>
          </div>
          <Button
            variant="danger"
            disabled={isSaving}
            onClick={async () => {
              if (!token) {
                return;
              }

              const result = await resetSystem(token, {
                confirmationText,
                reseedDemoCount: Number(reseedDemoCount || 0),
              });

              if (result.logout) {
                logout(result.message);
              }
            }}
          >
            {isSaving ? "Resetting..." : "Reset System"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
