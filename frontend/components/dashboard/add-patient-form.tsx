"use client";

import { useMemo, useState } from "react";
import { Role } from "@er-triage/shared";
import { AlertTriangle, Bot, ChevronDown, ChevronUp, ClipboardPlus, FlaskConical, Stethoscope } from "lucide-react";
import { DemoPatientModal } from "@/components/dashboard/demo-patient-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError } from "@/lib/api-client";
import { useAuthStore } from "@/store/use-auth-store";
import { usePatientStore } from "@/store/use-patient-store";

const sectionButtonClass = "flex-1 rounded-xl border border-border px-3 py-2 text-sm font-medium transition-colors";

const defaultVitals = {
  heartRate: "",
  bloodPressureSystolic: "",
  bloodPressureDiastolic: "",
  temperature: "",
  oxygenSaturation: "",
  bloodSugar: "",
};

const defaultHistory = {
  diabetes: false,
  hypertension: false,
  heartDisease: false,
  other: "",
};

const defaultInjury = {
  type: "",
  severity: "",
  bleeding: false,
  unconsciousReported: false,
};

export const AddPatientForm = ({ role }: { role: Role }) => {
  const token = useAuthStore((state) => state.token);
  const previewIntake = usePatientStore((state) => state.previewIntake);
  const createPatient = usePatientStore((state) => state.createPatient);
  const createQuickEntryPatient = usePatientStore((state) => state.createQuickEntryPatient);
  const generateDemoPatients = usePatientStore((state) => state.generateDemoPatients);
  const isGeneratingDemo = usePatientStore((state) => state.isGeneratingDemo);
  const isSubmitting = usePatientStore((state) => state.isSubmitting);
  const error = usePatientStore((state) => state.error);
  const clearError = usePatientStore((state) => state.clearError);
  const [mode, setMode] = useState<"full" | "quick">("full");
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const [previewSignature, setPreviewSignature] = useState("");
  const [preview, setPreview] = useState<{
    duplicate: { detected: boolean; patientId?: string; message?: string };
    llm: {
      status: string;
      normalizedSymptoms: string[];
      riskFlags: string[];
      criticalRiskConfidence: number;
      summary: string;
    };
  } | null>(null);
  const [confirmedSymptoms, setConfirmedSymptoms] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [controlledSymptoms, setControlledSymptoms] = useState("");
  const [otherText, setOtherText] = useState("");
  const [vitals, setVitals] = useState(defaultVitals);
  const [history, setHistory] = useState(defaultHistory);
  const [injury, setInjury] = useState(defaultInjury);
  const [isExpanded, setIsExpanded] = useState(false);

  if (role === Role.Viewer) {
    return null;
  }

  const intakePayload = useMemo(
    () => ({
      name,
      age: Number(age),
      gender,
      symptoms: {
        controlled: controlledSymptoms
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
        otherText,
      },
      vitals: {
        heartRate: vitals.heartRate ? Number(vitals.heartRate) : null,
        bloodPressureSystolic: vitals.bloodPressureSystolic ? Number(vitals.bloodPressureSystolic) : null,
        bloodPressureDiastolic: vitals.bloodPressureDiastolic ? Number(vitals.bloodPressureDiastolic) : null,
        temperature: vitals.temperature ? Number(vitals.temperature) : null,
        oxygenSaturation: vitals.oxygenSaturation ? Number(vitals.oxygenSaturation) : null,
        bloodSugar: vitals.bloodSugar ? Number(vitals.bloodSugar) : null,
      },
      injuryIncident: {
        type: injury.type,
        severity: injury.severity || null,
        bleeding: injury.bleeding,
        unconsciousReported: injury.unconsciousReported,
      },
      history,
    }),
    [age, controlledSymptoms, gender, history, injury, name, otherText, vitals],
  );

  const currentSignature = JSON.stringify(intakePayload);

  const resetPreview = () => {
    setPreview(null);
    setConfirmedSymptoms("");
    setPreviewSignature("");
    setDuplicateConfirmed(false);
    setShowDuplicateWarning(false);
  };

  const handleGenerateDemoPatients = async (count: number) => {
    if (!token) {
      return;
    }

    await generateDemoPatients(token, count);
    setIsDemoModalOpen(false);
  };

  const handleFullSubmit = async () => {
    if (!token) {
      return;
    }

    clearError();

    const requiresPreview = Boolean(otherText.trim());
    if (requiresPreview && previewSignature !== currentSignature) {
      const previewResult = await previewIntake(token, intakePayload);
      setPreview(previewResult);
      setConfirmedSymptoms(previewResult.llm.normalizedSymptoms.join("\n"));
      setPreviewSignature(currentSignature);

      if (previewResult.duplicate.detected) {
        setShowDuplicateWarning(true);
      }
      return;
    }

    if (preview?.duplicate.detected && !duplicateConfirmed) {
      setShowDuplicateWarning(true);
      return;
    }

    await createPatient(token, {
      ...intakePayload,
      confirmedNormalizedSymptoms: otherText.trim()
        ? confirmedSymptoms
            .split("\n")
            .map((entry) => entry.trim())
            .filter(Boolean)
        : [],
      duplicateConfirmed,
      waitingTimeMinutes: 0,
    });

    setName("");
    setAge("");
    setGender("male");
    setControlledSymptoms("");
    setOtherText("");
    setVitals(defaultVitals);
    setHistory(defaultHistory);
    setInjury(defaultInjury);
    resetPreview();
  };

  const handleQuickEntrySubmit = async () => {
    if (!token) {
      return;
    }

    clearError();
    try {
      await createQuickEntryPatient(token, {
        name,
        age: Number(age),
        gender,
        controlledSymptoms: controlledSymptoms
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
        otherText,
        vitals: {
          heartRate: vitals.heartRate ? Number(vitals.heartRate) : null,
          bloodPressureSystolic: vitals.bloodPressureSystolic ? Number(vitals.bloodPressureSystolic) : null,
          bloodPressureDiastolic: vitals.bloodPressureDiastolic ? Number(vitals.bloodPressureDiastolic) : null,
          temperature: vitals.temperature ? Number(vitals.temperature) : null,
          oxygenSaturation: vitals.oxygenSaturation ? Number(vitals.oxygenSaturation) : null,
          bloodSugar: vitals.bloodSugar ? Number(vitals.bloodSugar) : null,
        },
        duplicateConfirmed,
      });
      setName("");
      setAge("");
      setControlledSymptoms("");
      setOtherText("");
      setVitals(defaultVitals);
      setDuplicateConfirmed(false);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        setShowDuplicateWarning(true);
      }
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Patient Intake</CardTitle>
              <CardDescription className="mt-2">
                Open the intake tools only when needed to keep the dashboard compact during queue review.
              </CardDescription>
            </div>
            <Button className="justify-center" type="button" onClick={() => setIsExpanded((current) => !current)}>
              <ClipboardPlus className="mr-2 h-4 w-4" />
              {isExpanded ? "Hide Intake Tools" : "Add / Admit Patient"}
              {isExpanded ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {isExpanded ? (
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button className={`${sectionButtonClass} ${mode === "full" ? "bg-primary text-text-inverse" : "bg-card text-text-primary"}`} type="button" onClick={() => setMode("full")}>
              <ClipboardPlus className="mr-2 inline h-4 w-4" />
              Add Patient
            </button>
            <button className={`${sectionButtonClass} ${mode === "quick" ? "bg-primary text-text-inverse" : "bg-card text-text-primary"}`} type="button" onClick={() => setMode("quick")}>
              <Stethoscope className="mr-2 inline h-4 w-4" />
              Quick Entry
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button className="flex-1 justify-center" type="button" variant="secondary" onClick={() => setIsDemoModalOpen(true)} disabled={isGeneratingDemo}>
              <FlaskConical className="mr-2 h-4 w-4" />
              {isGeneratingDemo ? "Generating patients..." : "Generate Demo Patients"}
            </Button>
          </div>
          <div>
          <p className="text-base font-semibold text-text-primary">{mode === "full" ? "Add Patient" : "Quick Entry"}</p>
          <p className="mt-2 text-sm text-text-secondary">
            {mode === "full"
              ? "Full intake with duplicate detection, AI normalization review, and triage-backed save."
              : "Minimal emergency intake. Hard critical flags create the patient immediately while awaiting full data."}
          </p>
          </div>
          {error ? (
            <div className="rounded-xl border border-priority-critical bg-background px-3 py-3 text-sm text-priority-critical">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-4">
            <Input value={name} onChange={(event) => { setName(event.target.value); resetPreview(); }} placeholder="Patient name" />
            <Input value={age} onChange={(event) => { setAge(event.target.value); resetPreview(); }} type="number" min={1} max={90} placeholder="Age" />
            <select className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-text-primary" value={gender} onChange={(event) => { setGender(event.target.value as "male" | "female" | "other"); resetPreview(); }}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            <Input value={controlledSymptoms} onChange={(event) => { setControlledSymptoms(event.target.value); resetPreview(); }} placeholder="Controlled symptoms (comma separated)" />
            <Textarea value={otherText} onChange={(event) => { setOtherText(event.target.value); resetPreview(); }} placeholder="Other / natural language complaint" className="lg:col-span-4" />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Input value={vitals.heartRate} onChange={(event) => setVitals((state) => ({ ...state, heartRate: event.target.value }))} placeholder="Heart rate" />
            <Input value={vitals.oxygenSaturation} onChange={(event) => setVitals((state) => ({ ...state, oxygenSaturation: event.target.value }))} placeholder="SpO2" />
            <Input value={vitals.bloodPressureSystolic} onChange={(event) => setVitals((state) => ({ ...state, bloodPressureSystolic: event.target.value }))} placeholder="BP systolic" />
            <Input value={vitals.bloodPressureDiastolic} onChange={(event) => setVitals((state) => ({ ...state, bloodPressureDiastolic: event.target.value }))} placeholder="BP diastolic" />
            <Input value={vitals.temperature} onChange={(event) => setVitals((state) => ({ ...state, temperature: event.target.value }))} placeholder="Temperature" />
            <Input value={vitals.bloodSugar} onChange={(event) => setVitals((state) => ({ ...state, bloodSugar: event.target.value }))} placeholder="Blood sugar" />
          </div>

          {mode === "full" ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Input value={injury.type} onChange={(event) => { setInjury((state) => ({ ...state, type: event.target.value })); resetPreview(); }} placeholder="Injury type" />
                <select className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-text-primary" value={injury.severity} onChange={(event) => { setInjury((state) => ({ ...state, severity: event.target.value })); resetPreview(); }}>
                  <option value="">Severity</option>
                  <option value="minor">Minor</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
                <label className="flex items-center gap-2"><input type="checkbox" checked={injury.bleeding} onChange={(event) => { setInjury((state) => ({ ...state, bleeding: event.target.checked })); resetPreview(); }} /> Bleeding</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={injury.unconsciousReported} onChange={(event) => { setInjury((state) => ({ ...state, unconsciousReported: event.target.checked })); resetPreview(); }} /> Unconscious</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={history.diabetes} onChange={(event) => { setHistory((state) => ({ ...state, diabetes: event.target.checked })); resetPreview(); }} /> Diabetes</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={history.hypertension} onChange={(event) => { setHistory((state) => ({ ...state, hypertension: event.target.checked })); resetPreview(); }} /> Hypertension</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={history.heartDisease} onChange={(event) => { setHistory((state) => ({ ...state, heartDisease: event.target.checked })); resetPreview(); }} /> Heart disease</label>
              </div>
              <Textarea value={history.other} onChange={(event) => { setHistory((state) => ({ ...state, other: event.target.value })); resetPreview(); }} placeholder="Other history" />
            </>
          ) : null}

          {preview ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <Bot className="h-4 w-4 text-primary" />
                LLM interpreted the symptoms
              </div>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{preview.llm.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {preview.llm.riskFlags.map((flag) => (
                  <span key={flag} className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-text-primary">
                    {flag.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
              <Textarea className="mt-4" value={confirmedSymptoms} onChange={(event) => setConfirmedSymptoms(event.target.value)} placeholder="One normalized symptom per line" />
            </div>
          ) : null}

          <Button className="w-full justify-center" onClick={mode === "full" ? handleFullSubmit : handleQuickEntrySubmit} disabled={isSubmitting || !name || !age}>
            {isSubmitting ? "Saving..." : mode === "full" ? "Review & Save Patient" : "Create Quick Entry Patient"}
          </Button>
        </CardContent>
        ) : null}
      </Card>

      <DemoPatientModal
        isOpen={isDemoModalOpen}
        isLoading={isGeneratingDemo}
        onClose={() => setIsDemoModalOpen(false)}
        onGenerate={handleGenerateDemoPatients}
      />

      {showDuplicateWarning ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/30 px-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-priority-urgent/20 text-priority-urgent">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <CardTitle className="mt-4">Possible duplicate patient detected</CardTitle>
              <CardDescription className="mt-2">
                {preview?.duplicate.message ?? "An active patient with the same name, age, and gender already exists."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button
                className="flex-1 justify-center"
                onClick={() => {
                  setDuplicateConfirmed(true);
                  setShowDuplicateWarning(false);
                }}
              >
                Continue
              </Button>
              <Button className="flex-1 justify-center" variant="secondary" onClick={() => setShowDuplicateWarning(false)}>
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
};
