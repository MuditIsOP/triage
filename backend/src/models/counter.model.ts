import { Schema, model, type InferSchemaType } from "mongoose";

const counterSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    value: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

export type CounterDocument = InferSchemaType<typeof counterSchema>;

export const CounterModel = model<CounterDocument>("Counter", counterSchema);
