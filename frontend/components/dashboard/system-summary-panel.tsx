"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type DashboardOverview } from "@/store/use-system-store";

export const SystemSummaryPanel = ({ overview }: { overview: DashboardOverview | null }) => {
  if (!overview) {
    return null;
  }

  const summaryItems = [
    { label: "Active Patients", value: overview.summary.totalActivePatients },
    { label: "Critical", value: overview.summary.criticalPatients },
    { label: "Urgent", value: overview.summary.urgentPatients },
    { label: "Manual Review", value: overview.summary.manualReviewPatients },
  ];

  return (
    <Card className="border-white/45 bg-card/72">
      <CardHeader>
        <CardTitle>System Summary</CardTitle>
        <CardDescription>Live operational overview aligned to the queue and bed state.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className="rounded-[24px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.68),rgba(255,255,255,0.38))] px-4 py-4 shadow-panel backdrop-blur-glass"
          >
            <p className="text-xs uppercase tracking-[0.12em] text-text-secondary">{item.label}</p>
            <p className="mt-3 text-2xl font-semibold text-text-primary">{item.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
