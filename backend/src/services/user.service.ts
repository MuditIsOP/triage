import { AuditEventType, Role } from "@er-triage/shared";
import { UserModel } from "../models/user.model";
import { ApiError } from "../utils/api-error";
import { createAuditLog } from "./audit.service";
import { hashPassword } from "./auth.service";

export const listNurses = async () => UserModel.find({ role: Role.Nurse }).sort({ createdAt: -1 });

export const createNurse = async ({
  name,
  email,
  password,
  createdBy,
}: {
  name: string;
  email: string;
  password: string;
  createdBy: string;
}) => {
  const existingUser = await UserModel.findOne({ email: email.toLowerCase() });

  if (existingUser) {
    throw new ApiError(409, "A user with this email already exists");
  }

  const passwordHash = await hashPassword(password);
  const nurse = await UserModel.create({
    name: name.trim(),
    email: email.toLowerCase(),
    passwordHash,
    role: Role.Nurse,
    isDefaultAccount: false,
  });

  await createAuditLog({
    eventType: AuditEventType.NurseCreated,
    userId: createdBy,
    metadata: {
      nurseId: nurse.id,
      email: nurse.email,
    },
  });

  return nurse;
};

export const removeNurse = async ({ nurseId, removedBy }: { nurseId: string; removedBy: string }) => {
  const nurse = await UserModel.findById(nurseId);

  if (!nurse || nurse.role !== Role.Nurse) {
    throw new ApiError(404, "Nurse not found");
  }

  if (nurse.isDefaultAccount) {
    throw new ApiError(400, "Default nurse account cannot be removed");
  }

  await UserModel.deleteOne({ _id: nurse._id });

  await createAuditLog({
    eventType: AuditEventType.NurseRemoved,
    userId: removedBy,
    metadata: {
      nurseId: nurse.id,
      email: nurse.email,
    },
  });
};
