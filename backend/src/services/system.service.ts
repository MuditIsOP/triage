import { AuditEventType, PatientStatus, Priority } from "@er-triage/shared";
import { env } from "../config/env";
import { AuditLogModel } from "../models/audit-log.model";
import { PatientModel } from "../models/patient.model";
import { SystemConfigModel } from "../models/system-config.model";
import { createAuditLog } from "./audit.service";

const ACTIVE_STATUSES = [PatientStatus.Waiting, PatientStatus.InTreatment, PatientStatus.Completed];

export const getOrCreateSystemConfig = async () => {
  const existingConfig = await SystemConfigModel.findOne({ key: "default" });

  if (existingConfig) {
    return existingConfig;
  }

  return SystemConfigModel.create({
    key: "default",
    generalBedCount: env.DEFAULT_GENERAL_BEDS,
    criticalBedCount: env.DEFAULT_CRITICAL_BEDS,
    simulationEnabled: env.SIMULATION_ENABLED,
    simulationTickSeconds: env.SIMULATION_TICK_SECONDS,
  });
};

export const resetSystemConfig = async () => {
  const config = await getOrCreateSystemConfig();
  config.generalBedCount = env.DEFAULT_GENERAL_BEDS;
  config.criticalBedCount = env.DEFAULT_CRITICAL_BEDS;
  config.simulationEnabled = env.SIMULATION_ENABLED;
  config.simulationTickSeconds = env.SIMULATION_TICK_SECONDS;
  config.lastResetAt = new Date();
  await config.save();
  return config;
};

export const updateBedConfiguration = async ({
  generalBedCount,
  criticalBedCount,
  updatedBy,
}: {
  generalBedCount: number;
  criticalBedCount: number;
  updatedBy: string;
}) => {
  const [config, activePatients] = await Promise.all([
    getOrCreateSystemConfig(),
    PatientModel.find({ status: { $in: ACTIVE_STATUSES } }, { bedAssignment: 1, status: 1 }),
  ]);

  const occupiedGeneralBeds = activePatients.filter((patient) => patient.bedAssignment?.bedType === "general").length;
  const occupiedCriticalBeds = activePatients.filter((patient) => patient.bedAssignment?.bedType === "critical").length;

  if (generalBedCount < occupiedGeneralBeds) {
    throw new Error(
      `${occupiedGeneralBeds} general beds are currently occupied. You cannot reduce below ${occupiedGeneralBeds}.`,
    );
  }

  if (criticalBedCount < occupiedCriticalBeds) {
    throw new Error(
      `${occupiedCriticalBeds} critical beds are currently occupied. You cannot reduce below ${occupiedCriticalBeds}.`,
    );
  }

  const oldValue = {
    generalBedCount: config.generalBedCount,
    criticalBedCount: config.criticalBedCount,
  };

  config.generalBedCount = generalBedCount;
  config.criticalBedCount = criticalBedCount;
  await config.save();

  await createAuditLog({
    eventType: AuditEventType.BedAssigned,
    userId: updatedBy,
    oldValue,
    newValue: {
      generalBedCount,
      criticalBedCount,
    },
    metadata: {
      type: "bed_configuration_update",
    },
  });

  return config;
};

export const getDashboardOverview = async () => {
  const [config, patients, activity] = await Promise.all([
    getOrCreateSystemConfig(),
    PatientModel.find({ status: { $in: ACTIVE_STATUSES } }).sort({ createdAt: -1 }),
    AuditLogModel.find({})
      .populate("userId", "name email role")
      .populate("patientId", "patientId name")
      .sort({ timestamp: -1 })
      .limit(10),
  ]);

  const occupiedGeneralBeds = patients.filter((patient) => patient.bedAssignment?.bedType === "general").length;
  const occupiedCriticalBeds = patients.filter((patient) => patient.bedAssignment?.bedType === "critical").length;

  const summary = {
    totalActivePatients: patients.length,
    criticalPatients: patients.filter((patient) => patient.priority === Priority.Critical).length,
    urgentPatients: patients.filter((patient) => patient.priority === Priority.Urgent).length,
    manualReviewPatients: patients.filter((patient) => patient.manualReviewRequired).length,
    demoPatients: patients.filter((patient) => patient.isDemo).length,
  };

  const alerts = [
    ...patients
      .filter((patient) => patient.priority === Priority.Critical && patient.status === PatientStatus.Waiting)
      .slice(0, 3)
      .map((patient) => ({
        type: "critical",
        message: `Critical patient ${patient.patientId} requires immediate attention${patient.bedAssignment?.bedId ? ` in ${patient.bedAssignment.bedId}` : " and is waiting for bed placement"}.`,
      })),
    ...patients
      .filter((patient) => patient.bedReallocation?.state && patient.bedReallocation.state !== "none")
      .slice(0, 3)
      .map((patient) => ({
        type: patient.bedReallocation?.state === "transferring" ? "transfer" : "reassigned",
        message: `${patient.patientId}: ${patient.bedReallocation?.message ?? "Bed reassigned due to higher-acuity demand."}`,
      })),
    ...patients
      .filter((patient) => patient.manualReviewRequired)
      .slice(0, 3)
      .map((patient) => ({
        type: "manual_review",
        message: `${patient.patientId} is awaiting manual review.`,
      })),
    ...(occupiedCriticalBeds >= config.criticalBedCount
      ? [
          {
            type: "bed_shortage",
            message: "No critical beds available.",
          },
        ]
      : []),
    ...patients
      .filter((patient) => patient.ai?.llmStatus && patient.ai.llmStatus !== "success")
      .slice(0, 2)
      .map((patient) => ({
        type: "llm_unavailable",
        message: `AI fallback active for ${patient.patientId}.`,
      })),
  ];

  return {
    summary,
    beds: {
      general: {
        total: config.generalBedCount,
        occupied: occupiedGeneralBeds,
      },
      critical: {
        total: config.criticalBedCount,
        occupied: occupiedCriticalBeds,
      },
    },
    activity: activity.map((entry) => ({
      id: entry.id,
      eventType: entry.eventType,
      timestamp: entry.timestamp,
      user:
        entry.userId && typeof entry.userId === "object"
          ? {
              id: String(entry.userId._id),
              name: "name" in entry.userId ? String(entry.userId.name) : "",
              email: "email" in entry.userId ? String(entry.userId.email) : "",
            }
          : null,
      patient:
        entry.patientId && typeof entry.patientId === "object"
          ? {
              id: String(entry.patientId._id),
              patientId: "patientId" in entry.patientId ? String(entry.patientId.patientId) : "",
              name: "name" in entry.patientId ? String(entry.patientId.name) : "",
            }
          : null,
      metadata: entry.metadata ?? {},
    })),
    alerts,
  };
};
