import { Schema, model, type InferSchemaType } from "mongoose";

const systemConfigSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: "default",
    },
    generalBedCount: {
      type: Number,
      required: true,
      min: 1,
    },
    criticalBedCount: {
      type: Number,
      required: true,
      min: 1,
    },
    simulationEnabled: {
      type: Boolean,
      default: true,
    },
    simulationTickSeconds: {
      type: Number,
      required: true,
      min: 1,
    },
    lastResetAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export type SystemConfigDocument = InferSchemaType<typeof systemConfigSchema>;

export const SystemConfigModel = model<SystemConfigDocument>("SystemConfig", systemConfigSchema);
