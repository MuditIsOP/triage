"use client";

import { useEffect, useState } from "react";
import { Role, PatientStatus, Priority } from "@er-triage/shared";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PatientGuidanceAssistant } from "@/components/dashboard/patient-guidance-assistant";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/store/use-auth-store";
import { type PatientDetails, usePatientStore } from "@/store/use-patient-store";

const formatAuditLabel = (eventType: string) => eventType.replace(/_/g, " ");

export const PatientDetailsPanel = ({
  patient,
  role,
}: {
  patient: PatientDetails | null;
  role: Role;
}) => {
  const token = useAuthStore((state) => state.token);
  const updatePatient = usePatientStore((state) => state.updatePatient);
  const updatePatientStatus = usePatientStore((state) => state.updatePatientStatus);
  const applyOverride = usePatientStore((state) => state.applyOverride);
  const clearOverride = usePatientStore((state) => state.clearOverride);
  const deletePatient = usePatientStore((state) => state.deletePatient);
  const isSubmitting = usePatientStore((state) => state.isSubmitting);
  const [controlledSymptoms, setControlledSymptoms] = useState("");
  const [otherText, setOtherText] = useState("");
  const [doctorNotes, setDoctorNotes] = useState("");
  const [historyFlags, setHistoryFlags] = useState({
    diabetes: false,
    hypertension: false,
    heartDisease: false,
    other: "",
  });
  const [injuryType, setInjuryType] = useState("");
  const [injurySeverity, setInjurySeverity] = useState<string>("");
  const [bleeding, setBleeding] = useState(false);
  const [unconsciousReported, setUnconsciousReported] = useState(false);
  const [vitals, setVitals] = useState({
    heartRate: "",
    bloodPressureSystolic: "",
    bloodPressureDiastolic: "",
    temperature: "",
    oxygenSaturation: "",
    bloodSugar: "",
  });
  const [status, setStatus] = useState<PatientStatus>(PatientStatus.Waiting);
  const [referralDestination, setReferralDestination] = useState("");
  const [referralReason, setReferralReason] = useState("");
  const [overridePriority, setOverridePriority] = useState<Priority>(Priority.Urgent);
  const [overrideScope, setOverrideScope] = useState("");
  const [isGuidanceOpen, setIsGuidanceOpen] = useState(false);

  useEffect(() => {
    if (!patient) {
      return;
    }

    setControlledSymptoms((patient.symptoms.controlled ?? []).join(", "));
    setOtherText(patient.symptoms.otherText ?? "");
    setDoctorNotes(patient.doctorNotes ?? "");
    setHistoryFlags(patient.history);
    setInjuryType(patient.injuryIncident.type ?? "");
    setInjurySeverity(patient.injuryIncident.severity ?? "");
    setBleeding(patient.injuryIncident.bleeding);
    setUnconsciousReported(patient.injuryIncident.unconsciousReported);
    setVitals({
      heartRate: patient.vitals.heartRate.value?.toString() ?? "",
      bloodPressureSystolic: patient.vitals.bloodPressureSystolic.value?.toString() ?? "",
      bloodPressureDiastolic: patient.vitals.bloodPressureDiastolic.value?.toString() ?? "",
      temperature: patient.vitals.temperature.value?.toString() ?? "",
      oxygenSaturation: patient.vitals.oxygenSaturation.value?.toString() ?? "",
      bloodSugar: patient.vitals.bloodSugar.value?.toString() ?? "",
    });
    setStatus(patient.status);
    setReferralDestination(patient.referral.destination ?? "");
    setReferralReason(patient.referral.reason ?? "");
    setOverridePriority(patient.override.priority ?? Priority.Urgent);
    setOverrideScope(patient.override.scope ?? "");
    setIsGuidanceOpen(false);
  }, [patient]);

  if (!patient) {
    return (
      <Card className="flex min-h-[560px] flex-col border-white/45 bg-card/72">
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Select a patient to inspect AI reasoning, vitals, notes, and audit preview.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-[24px] border border-dashed border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.58),rgba(255,255,255,0.34))] px-4 py-12 text-center text-sm text-text-secondary backdrop-blur-glass">
            The details panel updates when a patient is selected from the queue.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (role === Role.Viewer) {
    return null;
  }

  const chartData = patient.vitalsHistory.map((entry) => ({
    time: new Date(entry.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    score: entry.score,
    oxygen: entry.oxygenSaturation,
    heartRate: entry.heartRate,
  }));
  const chartValues = chartData
    .flatMap((entry) => [entry.score, entry.oxygen, entry.heartRate])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const minChartValue = chartValues.length > 0 ? Math.min(...chartValues) : 0;
  const maxChartValue = chartValues.length > 0 ? Math.max(...chartValues) : 100;
  const chartPadding = minChartValue === maxChartValue ? Math.max(8, Math.round(maxChartValue * 0.08) || 8) : 8;
  const hasFlatHistory =
    chartData.length > 1 &&
    chartData.every(
      (entry) =>
        entry.score === chartData[0]?.score &&
        entry.oxygen === chartData[0]?.oxygen &&
        entry.heartRate === chartData[0]?.heartRate,
    );

  const handleClinicalSave = async () => {
    if (!token) {
      return;
    }

    await updatePatient(token, patient.patientId, {
      version: patient.version,
      symptoms: {
        controlled: controlledSymptoms
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
        otherText,
        confirmedNormalizedSymptoms: patient.normalizedSymptoms,
      },
      vitals: {
        heartRate: { value: vitals.heartRate ? Number(vitals.heartRate) : null },
        bloodPressureSystolic: { value: vitals.bloodPressureSystolic ? Number(vitals.bloodPressureSystolic) : null },
        bloodPressureDiastolic: { value: vitals.bloodPressureDiastolic ? Number(vitals.bloodPressureDiastolic) : null },
        temperature: { value: vitals.temperature ? Number(vitals.temperature) : null },
        oxygenSaturation: { value: vitals.oxygenSaturation ? Number(vitals.oxygenSaturation) : null },
        bloodSugar: { value: vitals.bloodSugar ? Number(vitals.bloodSugar) : null },
      },
      injuryIncident: {
        type: injuryType,
        severity: injurySeverity || null,
        bleeding,
        unconsciousReported,
      },
      history: historyFlags,
      doctorNotes,
    });
  };

  const handleStatusSave = async () => {
    if (!token) {
      return;
    }

    await updatePatientStatus(token, patient.patientId, {
      version: patient.version,
      status,
      clearManualReview: patient.manualReviewRequired,
      referral:
        status === PatientStatus.Referred
          ? {
              destination: referralDestination,
              reason: referralReason,
            }
          : undefined,
    });
  };

  const handleApplyOverride = async () => {
    if (!token) {
      return;
    }

    await applyOverride(token, patient.patientId, {
      version: patient.version,
      priority: overridePriority,
      scope: overrideScope,
    });
  };

  const handleClearOverride = async () => {
    if (!token) {
      return;
    }

    await clearOverride(token, patient.patientId, patient.version);
  };

  const handleDeletePatient = async () => {
    if (!token) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${patient.patientId}${patient.name ? ` (${patient.name})` : ""}? This removes the patient record from the queue.`,
    );

    if (!confirmed) {
      return;
    }

    await deletePatient(token, patient.patientId);
  };

  return (
    <Card className="flex min-h-[560px] flex-col border-white/45 bg-card/72">
      <CardHeader>
        <CardTitle>Details</CardTitle>
        <CardDescription>AI explanation, clinical updates, graphs, notes, and audit preview.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 overflow-y-auto">
        <div className="rounded-[24px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.68),rgba(255,255,255,0.42))] px-4 py-4 shadow-panel backdrop-blur-glass">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-hover px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-text-primary">
              {patient.priority}
            </span>
            {patient.manualReviewRequired ? (
              <span className="rounded-full bg-priority-urgent px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-text-primary">
                Awaiting Review
              </span>
            ) : null}
            {patient.override.isActive ? (
              <span className="rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                Doctor Override
              </span>
            ) : null}
            {patient.bedReallocation.state === "transferring" ? (
              <span className="rounded-full border border-priority-critical bg-priority-critical/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-priority-critical">
                Transferring
              </span>
            ) : null}
            {patient.bedReallocation.state === "reassigned" ? (
              <span className="rounded-full border border-priority-urgent bg-priority-urgent/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-text-primary">
                Reassigned
              </span>
            ) : null}
          </div>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => setIsGuidanceOpen(true)}>
              Open Patient AI Guide
            </Button>
          </div>
          {patient.bedReallocation.state !== "none" ? (
            <div className="mt-4 rounded-2xl border border-white/45 bg-white/42 px-3 py-3 text-sm leading-6 text-text-secondary backdrop-blur-glass">
              {patient.bedReallocation.message}
            </div>
          ) : null}
          <p className="mt-3 text-sm font-medium text-text-primary">Top Factor</p>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{patient.topFactor}</p>
          <p className="mt-4 text-sm font-medium text-text-primary">AI Summary</p>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{patient.aiSummary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {patient.riskFlags.map((flag) => (
              <span key={flag} className="rounded-full border border-white/55 bg-white/44 px-3 py-1 text-xs font-medium text-text-primary">
                {flag.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.68),rgba(255,255,255,0.42))] px-4 py-4 shadow-panel backdrop-blur-glass">
          <p className="text-sm font-medium text-text-primary">Vitals Trend</p>
          <div className="mt-4 h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="rgba(97,112,140,0.14)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--text-secondary)" fontSize={12} />
                <YAxis
                  stroke="var(--text-secondary)"
                  fontSize={12}
                  domain={[Math.max(0, minChartValue - chartPadding), maxChartValue + chartPadding]}
                />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={hasFlatHistory ? { r: 3, fill: "var(--primary)" } : false}
                />
                <Line
                  type="monotone"
                  dataKey="oxygen"
                  stroke="var(--priority-critical)"
                  strokeWidth={2}
                  dot={hasFlatHistory ? { r: 3, fill: "var(--priority-critical)" } : false}
                />
                <Line
                  type="monotone"
                  dataKey="heartRate"
                  stroke="var(--priority-urgent)"
                  strokeWidth={2}
                  dot={hasFlatHistory ? { r: 3, fill: "var(--priority-urgent)" } : false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {hasFlatHistory ? (
            <p className="mt-3 text-xs leading-5 text-text-secondary">
              Recent vitals are unchanged across recorded snapshots, so this patient currently shows a flat clinical trace.
            </p>
          ) : null}
        </div>

        <div className="rounded-[24px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.68),rgba(255,255,255,0.42))] px-4 py-4 shadow-panel backdrop-blur-glass">
          <p className="text-sm font-medium text-text-primary">Clinical Update</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Input value={controlledSymptoms} onChange={(event) => setControlledSymptoms(event.target.value)} placeholder="Controlled symptoms (comma separated)" />
            <Input value={injuryType} onChange={(event) => setInjuryType(event.target.value)} placeholder="Injury type" />
            <Textarea value={otherText} onChange={(event) => setOtherText(event.target.value)} placeholder="Free-text symptoms / complaint" className="md:col-span-2" />
            <Input value={vitals.heartRate} onChange={(event) => setVitals((state) => ({ ...state, heartRate: event.target.value }))} placeholder="Heart rate" />
            <Input value={vitals.oxygenSaturation} onChange={(event) => setVitals((state) => ({ ...state, oxygenSaturation: event.target.value }))} placeholder="SpO2" />
            <Input value={vitals.bloodPressureSystolic} onChange={(event) => setVitals((state) => ({ ...state, bloodPressureSystolic: event.target.value }))} placeholder="BP systolic" />
            <Input value={vitals.bloodPressureDiastolic} onChange={(event) => setVitals((state) => ({ ...state, bloodPressureDiastolic: event.target.value }))} placeholder="BP diastolic" />
            <Input value={vitals.temperature} onChange={(event) => setVitals((state) => ({ ...state, temperature: event.target.value }))} placeholder="Temperature" />
            <Input value={vitals.bloodSugar} onChange={(event) => setVitals((state) => ({ ...state, bloodSugar: event.target.value }))} placeholder="Blood sugar" />
            <Input value={historyFlags.other} onChange={(event) => setHistoryFlags((state) => ({ ...state, other: event.target.value }))} placeholder="History notes" className="md:col-span-2" />
            <select className="h-11 rounded-2xl border border-white/45 bg-white/54 px-3 text-sm text-text-primary outline-none backdrop-blur-glass" value={injurySeverity} onChange={(event) => setInjurySeverity(event.target.value)}>
              <option value="">Severity</option>
              <option value="minor">Minor</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </select>
            <div className="flex items-center gap-4 text-sm text-text-secondary">
              <label className="flex items-center gap-2"><input type="checkbox" checked={bleeding} onChange={(event) => setBleeding(event.target.checked)} /> Bleeding</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={unconsciousReported} onChange={(event) => setUnconsciousReported(event.target.checked)} /> Unconscious</label>
            </div>
            <div className="flex items-center gap-4 text-sm text-text-secondary md:col-span-2">
              <label className="flex items-center gap-2"><input type="checkbox" checked={historyFlags.diabetes} onChange={(event) => setHistoryFlags((state) => ({ ...state, diabetes: event.target.checked }))} /> Diabetes</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={historyFlags.hypertension} onChange={(event) => setHistoryFlags((state) => ({ ...state, hypertension: event.target.checked }))} /> Hypertension</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={historyFlags.heartDisease} onChange={(event) => setHistoryFlags((state) => ({ ...state, heartDisease: event.target.checked }))} /> Heart disease</label>
            </div>
            <Textarea value={doctorNotes} onChange={(event) => setDoctorNotes(event.target.value)} placeholder="Doctor notes" className="md:col-span-2" />
          </div>
          <Button className="mt-4 w-full justify-center" onClick={handleClinicalSave} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : patient.awaitingFullData ? "Complete Intake" : "Save Clinical Update"}
          </Button>
        </div>

        <div className="rounded-[24px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.68),rgba(255,255,255,0.42))] px-4 py-4 shadow-panel backdrop-blur-glass">
          <p className="text-sm font-medium text-text-primary">Status & Referral</p>
          <div className="mt-4 grid gap-3">
            <select className="h-11 rounded-2xl border border-white/45 bg-white/54 px-3 text-sm text-text-primary outline-none backdrop-blur-glass" value={status} onChange={(event) => setStatus(event.target.value as PatientStatus)}>
              {Object.values(PatientStatus).map((option) => (
                <option key={option} value={option}>{option.replace(/_/g, " ")}</option>
              ))}
            </select>
            {status === PatientStatus.Referred ? (
              <>
                <Input value={referralDestination} onChange={(event) => setReferralDestination(event.target.value)} placeholder="Referral destination" />
                <Textarea value={referralReason} onChange={(event) => setReferralReason(event.target.value)} placeholder="Referral reason" />
              </>
            ) : null}
          </div>
          <Button className="mt-4 w-full justify-center" variant="secondary" onClick={handleStatusSave} disabled={isSubmitting}>
            Update Status
          </Button>
        </div>

        {role === Role.Doctor ? (
          <div className="rounded-[24px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.68),rgba(255,255,255,0.42))] px-4 py-4 shadow-panel backdrop-blur-glass">
            <p className="text-sm font-medium text-text-primary">Doctor Override</p>
            <div className="mt-4 grid gap-3">
              <select className="h-11 rounded-2xl border border-white/45 bg-white/54 px-3 text-sm text-text-primary outline-none backdrop-blur-glass" value={overridePriority} onChange={(event) => setOverridePriority(event.target.value as Priority)}>
                {Object.values(Priority).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <Textarea value={overrideScope} onChange={(event) => setOverrideScope(event.target.value)} placeholder="Override scope and rationale" />
            </div>
            <div className="mt-4 flex gap-3">
              <Button className="flex-1 justify-center" onClick={handleApplyOverride} disabled={isSubmitting}>Apply Override</Button>
              <Button className="flex-1 justify-center" variant="secondary" onClick={handleClearOverride} disabled={isSubmitting || !patient.override.isActive}>Clear Override</Button>
            </div>
          </div>
        ) : null}

        {role === Role.Doctor ? (
          <div className="rounded-[24px] border border-priority-critical/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.62),rgba(255,77,87,0.1))] px-4 py-4 shadow-panel backdrop-blur-glass">
            <p className="text-sm font-medium text-text-primary">Delete Patient Record</p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Doctor-only action. Use this to remove an individual patient record without resetting the full system.
            </p>
            <Button className="mt-4 w-full justify-center" variant="danger" onClick={handleDeletePatient} disabled={isSubmitting}>
              {isSubmitting ? "Deleting..." : "Delete Patient"}
            </Button>
          </div>
        ) : null}

        <div className="rounded-[24px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.68),rgba(255,255,255,0.42))] px-4 py-4 shadow-panel backdrop-blur-glass">
          <p className="text-sm font-medium text-text-primary">Audit Preview</p>
          <div className="mt-4 space-y-3">
            {patient.auditPreview.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-white/45 bg-white/42 px-3 py-3 backdrop-blur-glass">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">{formatAuditLabel(entry.eventType)}</p>
                <p className="mt-2 text-sm text-text-secondary">{new Date(entry.timestamp).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <PatientGuidanceAssistant patient={patient} isOpen={isGuidanceOpen} onClose={() => setIsGuidanceOpen(false)} />
    </Card>
  );
};
