import { AuditEventType } from "@er-triage/shared";
import { asyncHandler } from "../utils/async-handler";
import { PatientModel } from "../models/patient.model";
import { ApiError } from "../utils/api-error";
import { createAuditLog } from "../services/audit.service";
import { generateDemoPatients } from "../services/patient.service";
import { preserveDefaultUsersOnReset } from "../services/seed.service";
import { getDashboardOverview, resetSystemConfig, updateBedConfiguration } from "../services/system.service";

export const resetSystem = asyncHandler(async (request, response) => {
  if (!request.user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { confirmationText, reseedDemoCount } = request.body as {
    confirmationText?: string;
    reseedDemoCount?: number;
  };

  if (confirmationText !== "RESET") {
    throw new ApiError(400, "Type RESET to confirm system reset");
  }

  await PatientModel.deleteMany({});
  await resetSystemConfig();
  await preserveDefaultUsersOnReset();

  if (Number.isInteger(reseedDemoCount) && Number(reseedDemoCount) > 0) {
    await generateDemoPatients(Number(reseedDemoCount), request.user.id);
  }

  await createAuditLog({
    eventType: AuditEventType.SystemReset,
    userId: request.user.id,
    metadata: {
      reseedDemoCount: Number.isInteger(reseedDemoCount) ? Number(reseedDemoCount) : 0,
    },
  });

  response.status(200).json({
    message: "System has been reset by administrator",
    logout: true,
  });
});

export const getSystemOverview = asyncHandler(async (_request, response) => {
  const overview = await getDashboardOverview();
  response.status(200).json(overview);
});

export const putBedConfiguration = asyncHandler(async (request, response) => {
  if (!request.user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { generalBedCount, criticalBedCount } = request.body as {
    generalBedCount?: number;
    criticalBedCount?: number;
  };

  if (!Number.isInteger(generalBedCount) || !Number.isInteger(criticalBedCount)) {
    throw new ApiError(400, "General and critical bed counts are required");
  }

  try {
    const config = await updateBedConfiguration({
      generalBedCount: Number(generalBedCount),
      criticalBedCount: Number(criticalBedCount),
      updatedBy: request.user.id,
    });

    response.status(200).json({
      generalBedCount: config.generalBedCount,
      criticalBedCount: config.criticalBedCount,
    });
  } catch (error) {
    throw new ApiError(400, error instanceof Error ? error.message : "Unable to update bed configuration");
  }
});
