import { AuditEventType } from "@er-triage/shared";
import { AuditLogModel } from "../models/audit-log.model";

type CreateAuditLogInput = {
  eventType: AuditEventType;
  userId?: string | null;
  patientId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
};

export const createAuditLog = async ({
  eventType,
  userId = null,
  patientId = null,
  oldValue = null,
  newValue = null,
  metadata = {},
}: CreateAuditLogInput) =>
  AuditLogModel.create({
    eventType,
    userId,
    patientId,
    oldValue,
    newValue,
    metadata,
  });

export const listAuditLogs = async ({
  eventType,
  patientId,
  limit = 100,
}: {
  eventType?: AuditEventType;
  patientId?: string;
  limit?: number;
}) => {
  const query: Record<string, unknown> = {};

  if (eventType) {
    query.eventType = eventType;
  }

  if (patientId) {
    query.patientId = patientId;
  }

  return AuditLogModel.find(query)
    .populate("userId", "name email role")
    .populate("patientId", "patientId name")
    .sort({ timestamp: -1 })
    .limit(limit);
};
