import { AuditEventType, Role } from "@er-triage/shared";
import { asyncHandler } from "../utils/async-handler";
import { ApiError } from "../utils/api-error";
import { listAuditLogs } from "../services/audit.service";

export const getAuditLogs = asyncHandler(async (request, response) => {
  if (!request.user || request.user.role !== Role.Doctor) {
    throw new ApiError(403, "Only doctors can view audit logs");
  }

  const eventType = (request.query.eventType as AuditEventType | undefined) ?? undefined;
  const patientId = (request.query.patientId as string | undefined) ?? undefined;
  const logs = await listAuditLogs({ eventType, patientId, limit: 200 });

  response.status(200).json({
    logs: logs.map((entry) => ({
      id: entry.id,
      eventType: entry.eventType,
      timestamp: entry.timestamp,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      metadata: entry.metadata ?? {},
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
    })),
  });
});
