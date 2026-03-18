import { CounterModel } from "../models/counter.model";

export const getNextPatientSequence = async () => {
  const counter = await CounterModel.findOneAndUpdate(
    { key: "patient-sequence" },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return counter.value;
};

export const formatPatientId = (sequenceNumber: number) => `ER-${String(sequenceNumber).padStart(4, "0")}`;
