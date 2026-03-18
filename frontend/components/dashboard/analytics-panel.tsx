"use client";

import { useEffect } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/store/use-auth-store";
import { type PatientDetails, usePatientStore } from "@/store/use-patient-store";
import { useSystemStore } from "@/store/use-system-store";

export const AnalyticsPanel = ({ selectedPatient }: { selectedPatient: PatientDetails | null }) => {
  const token = useAuthStore((state) => state.token);
  const analytics = useSystemStore((state) => state.analytics);
  const loadAnalytics = useSystemStore((state) => state.loadAnalytics);
  const queuePatients = usePatientStore((state) => state.patients);

  useEffect(() => {
    if (token) {
      void loadAnalytics(token);
    }
  }, [loadAnalytics, token]);

  const trendData =
    selectedPatient?.vitalsHistory.map((entry) => ({
      time: new Date(entry.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      score: entry.score,
      oxygen: entry.oxygenSaturation,
      heartRate: entry.heartRate,
    })) ?? [];

  const summaryItems = [
    { label: "Tracked Patients", value: analytics.length },
    {
      label: "Avg Critical Score",
      value:
        analytics.length === 0
          ? 0
          : Math.round(analytics.reduce((total, patient) => total + patient.score, 0) / analytics.length),
    },
    {
      label: "Highest Wait",
      value: `${Math.max(0, ...queuePatients.map((patient) => Math.round(patient.waitingTimeMinutes)))} min`,
    },
    {
      label: "Beds Assigned",
      value: queuePatients.filter((patient) => patient.bedLabel).length,
    },
  ];

  const queueComparisonData = queuePatients.slice(0, 10).map((patient) => ({
    patientId: patient.patientId,
    score: patient.score ?? 0,
    waitingTime: Math.round(patient.waitingTimeMinutes),
  }));

  const priorityBreakdown = [
    {
      name: "Critical",
      value: queuePatients.filter((patient) => patient.priority === "critical").length,
      color: "var(--priority-critical)",
    },
    {
      name: "Urgent",
      value: queuePatients.filter((patient) => patient.priority === "urgent").length,
      color: "var(--priority-urgent)",
    },
    {
      name: "Normal",
      value: queuePatients.filter((patient) => patient.priority === "normal").length,
      color: "var(--priority-normal)",
    },
  ].filter((entry) => entry.value > 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryItems.map((item) => (
          <Card key={item.label}>
            <CardContent className="px-5 py-5">
              <p className="text-xs uppercase tracking-[0.14em] text-text-secondary">{item.label}</p>
              <p className="mt-3 text-2xl font-semibold text-text-primary">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Top Critical Patients</CardTitle>
          <CardDescription>Patient comparison by score using patient IDs for direct queue tracking.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="patientId" interval={0} angle={-18} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="score" fill="var(--primary)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Queue Wait vs Score</CardTitle>
          <CardDescription>Compare waiting time and score across visible patients using patient IDs.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={queueComparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="patientId" interval={0} angle={-18} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="waitingTime" fill="var(--priority-urgent)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="score" fill="var(--primary)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Selected Patient Trend</CardTitle>
          <CardDescription>Vital and score trend for the currently selected patient.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="oxygen" stroke="var(--priority-critical)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="heartRate" stroke="var(--priority-urgent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Priority Mix</CardTitle>
          <CardDescription>Live distribution of queue priority levels.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={priorityBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={86} paddingAngle={4}>
                {priorityBreakdown.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};
