import assert from "node:assert/strict";
import mongoose from "mongoose";
import supertest from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { LlmStatus, PatientStatus, Priority, Role, RiskFlag } from "@er-triage/shared";
import { ApiError } from "../utils/api-error";

const run = async () => {
  const mongoServer = await MongoMemoryServer.create();

  process.env.PORT = "5000";
  process.env.MONGO_URI = mongoServer.getUri();
  process.env.JWT_SECRET = "smoke-test-secret";
  process.env.XAI_API_KEY = "smoke-test-xai-key";
  process.env.XAI_BASE_URL = "https://api.x.ai/v1";
  process.env.XAI_MODEL = "grok-3";
  process.env.SEED_ENABLED = "false";
  process.env.DEFAULT_GENERAL_BEDS = "2";
  process.env.DEFAULT_CRITICAL_BEDS = "1";
  process.env.SIMULATION_ENABLED = "true";
  process.env.SIMULATION_TICK_SECONDS = "30";

  const [
    { connectToDatabase },
    { createApp },
    { seedDefaultUsers },
    { UserModel },
    {
      createPatient,
      createQuickEntryPatient,
      applyDoctorOverride,
      clearDoctorOverride,
      generateDemoPatients,
      getPatientDetails,
      listQueuePatients,
      processSimulationTick,
      updatePatientStatus,
    },
    { createNurse, removeNurse },
    { getDashboardOverview, updateBedConfiguration },
    { listAuditLogs },
    { hashPassword },
  ] = await Promise.all([
    import("../config/database"),
    import("../app"),
    import("../services/seed.service"),
    import("../models/user.model"),
    import("../services/patient.service"),
    import("../services/user.service"),
    import("../services/system.service"),
    import("../services/audit.service"),
    import("../services/auth.service"),
  ]);

  await connectToDatabase();
  await seedDefaultUsers();

  const viewerPasswordHash = await hashPassword("Viewer@123");
  await UserModel.create({
    name: "Default Viewer",
    email: "viewer@er.com",
    passwordHash: viewerPasswordHash,
    role: Role.Viewer,
  });

  const doctor = await UserModel.findOne({ email: "doctor@er.com" });
  const nurse = await UserModel.findOne({ email: "nurse@er.com" });
  const viewer = await UserModel.findOne({ email: "viewer@er.com" });
  assert.ok(doctor && nurse && viewer);

  const createdPatient = await createPatient(
    {
      name: "Riya Patel",
      age: 34,
      gender: "female",
      symptoms: {
        controlled: ["chest pain"],
        otherText: "",
      },
      vitals: {
        heartRate: 118,
        bloodPressureSystolic: 94,
        bloodPressureDiastolic: 64,
        temperature: 98.9,
        oxygenSaturation: 95,
        bloodSugar: 136,
      },
      injuryIncident: {
        type: "",
        severity: null,
        bleeding: false,
        unconsciousReported: false,
      },
      history: {
        diabetes: false,
        hypertension: true,
        heartDisease: true,
        other: "",
      },
      confirmedNormalizedSymptoms: [],
    },
    nurse.id,
  );

  assert.equal(createdPatient.patientId, "ER-0001");

  await assert.rejects(
    () =>
      createPatient(
        {
          name: "Riya Patel",
          age: 34,
          gender: "female",
          symptoms: {
            controlled: ["chest pain"],
            otherText: "",
          },
          vitals: {
            heartRate: 88,
            bloodPressureSystolic: 122,
            bloodPressureDiastolic: 78,
            temperature: 98.2,
            oxygenSaturation: 98,
            bloodSugar: 108,
          },
          confirmedNormalizedSymptoms: [],
        },
        nurse.id,
      ),
    (error) => error instanceof ApiError && error.statusCode === 409,
  );

  const quickEntryPatient = await createQuickEntryPatient(
    {
      name: "Aman Verma",
      age: 28,
      gender: "male",
      controlledSymptoms: ["breathing difficulty"],
      vitals: {
        oxygenSaturation: 81,
        bloodPressureSystolic: 82,
        bloodPressureDiastolic: 50,
        heartRate: 138,
      },
    },
    nurse.id,
  );

  assert.equal(quickEntryPatient.priority, Priority.Critical);
  assert.equal(quickEntryPatient.awaitingFullData, true);

  const overriddenPatient = await applyDoctorOverride(
    createdPatient.patientId,
    {
      version: createdPatient.version,
      priority: Priority.Critical,
      scope: "Cardiology escalation",
    },
    doctor.id,
  );

  assert.equal(overriddenPatient.doctorOverride?.isActive, true);

  const clearedOverridePatient = await clearDoctorOverride(
    overriddenPatient.patientId,
    overriddenPatient.version,
    doctor.id,
  );

  assert.equal(clearedOverridePatient.doctorOverride?.isActive, false);

  const referredPatient = await updatePatientStatus(
    quickEntryPatient.patientId,
    {
      version: quickEntryPatient.version,
      status: PatientStatus.Referred,
      referral: {
        destination: "City Trauma Center",
        reason: "Critical respiratory overflow",
      },
    },
    doctor.id,
    Role.Doctor,
  );

  assert.equal(referredPatient.status, "referred");
  assert.equal(referredPatient.bedAssignment?.bedId, null);

  const newNurse = await createNurse({
    name: "Night Shift Nurse",
    email: "night-nurse@er.com",
    password: "Night@123",
    createdBy: doctor.id,
  });

  assert.equal(newNurse.role, Role.Nurse);
  await removeNurse({ nurseId: newNurse.id, removedBy: doctor.id });

  await updateBedConfiguration({
    generalBedCount: 2,
    criticalBedCount: 1,
    updatedBy: doctor.id,
  });

  const demoPatients = await generateDemoPatients(
    2,
    doctor.id,
    async ({ symptoms }: { symptoms: string }) => ({
      status: LlmStatus.Success,
      risk_flags: symptoms.toLowerCase().includes("bleeding")
        ? [RiskFlag.ExternalBleeding, RiskFlag.Trauma]
        : [RiskFlag.CardiacRisk],
      critical_risk_confidence: 82,
      summary: "High-risk demo scenario",
      normalized_symptoms: ["demo symptom"],
    }),
  );

  assert.equal(demoPatients.length, 2);
  const tickUpdates = await processSimulationTick();
  assert.ok(tickUpdates.length >= 1);

  const doctorQueue = await listQueuePatients(Role.Doctor);
  const viewerQueue = await listQueuePatients(Role.Viewer);
  assert.ok(doctorQueue.some((patient) => patient.name));
  assert.ok(viewerQueue.every((patient) => !("name" in patient) || patient.name === undefined));
  assert.ok(viewerQueue.every((patient) => !("score" in patient) || patient.score === undefined));

  const detail = await getPatientDetails(createdPatient.patientId, Role.Doctor);
  assert.ok(detail.vitalsHistory.length >= 1);

  const overview = await getDashboardOverview();
  assert.ok(overview.summary.totalActivePatients >= 1);
  assert.ok(overview.activity.length >= 1);

  const auditLogs = await listAuditLogs({ limit: 50 });
  assert.ok(auditLogs.length >= 5);

  const app = createApp();
  const request = supertest(app);

  const doctorLogin = await request.post("/api/auth/login").send({
    email: "doctor@er.com",
    password: "Doctor@123",
  });
  assert.equal(doctorLogin.status, 200);

  const resetResponse = await request
    .post("/api/system/reset")
    .set("Authorization", `Bearer ${doctorLogin.body.token as string}`)
    .send({
      confirmationText: "RESET",
      reseedDemoCount: 0,
    });

  assert.equal(resetResponse.status, 200);
  assert.equal(resetResponse.body.message, "System has been reset by administrator");

  const meAfterReset = await request
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${doctorLogin.body.token as string}`);

  assert.equal(meAfterReset.status, 401);

  await mongoose.disconnect();
  await mongoServer.stop();

  console.log("Workflow smoke test passed.");
};

void run();
