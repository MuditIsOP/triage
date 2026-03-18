"use client";

import { useState } from "react";
import { FlaskConical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const DemoPatientModal = ({
  isOpen,
  isLoading,
  onClose,
  onGenerate,
}: {
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onGenerate: (count: number) => Promise<void>;
}) => {
  const [count, setCount] = useState("5");

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onGenerate(Number(count));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-text-inverse">
              <FlaskConical className="h-5 w-5" />
            </div>
            <CardTitle className="mt-4">Generate Demo Patients</CardTitle>
            <CardDescription className="mt-2">
              Create realistic ER demo patients and add them to the live queue.
            </CardDescription>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="demo-count">
                Number of patients
              </label>
              <Input
                id="demo-count"
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(event) => setCount(event.target.value)}
                required
              />
            </div>
            <div className="flex gap-3">
              <Button className="flex-1 justify-center" type="submit" disabled={isLoading}>
                {isLoading ? "Generating patients..." : "Generate"}
              </Button>
              <Button
                className="flex-1 justify-center"
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
