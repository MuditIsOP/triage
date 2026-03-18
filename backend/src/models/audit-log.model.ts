import { AuditEventType } from "@er-triage/shared";
import { Schema, model, type InferSchemaType } from "mongoose";

const auditLogSchema = new Schema(
  {
    eventType: {
      type: String,
      enum: Object.values(AuditEventType),
      required: true,
      index: true,
      immutable: true,
      alias: "event_type",
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      immutable: true,
      alias: "user_id",
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "Patient",
      default: null,
      immutable: true,
      alias: "patient_id",
    },
    oldValue: {
      type: Schema.Types.Mixed,
      default: null,
      immutable: true,
      alias: "old_value",
    },
    newValue: {
      type: Schema.Types.Mixed,
      default: null,
      immutable: true,
      alias: "new_value",
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
      immutable: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: false,
  },
);

export type AuditLogDocument = InferSchemaType<typeof auditLogSchema>;

export const AuditLogModel = model<AuditLogDocument>("AuditLog", auditLogSchema);
