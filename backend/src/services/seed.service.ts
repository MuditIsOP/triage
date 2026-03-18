import { Role } from "@er-triage/shared";
import { UserModel } from "../models/user.model";
import { hashPassword } from "./auth.service";

export const defaultUsers = [
  {
    name: "Default Doctor",
    email: "doctor@er.com",
    password: "Doctor@123",
    role: Role.Doctor,
  },
  {
    name: "Default Nurse",
    email: "nurse@er.com",
    password: "Nurse@123",
    role: Role.Nurse,
  },
];

export const seedDefaultUsers = async () => {
  for (const user of defaultUsers) {
    const existingUser = await UserModel.findOne({ email: user.email });

    if (existingUser) {
      continue;
    }

    const passwordHash = await hashPassword(user.password);

    await UserModel.create({
      name: user.name,
      email: user.email,
      passwordHash,
      role: user.role,
      isDefaultAccount: true,
    });
  }
};

export const preserveDefaultUsersOnReset = async () => {
  await UserModel.deleteMany({ email: { $nin: defaultUsers.map((user) => user.email) } });

  const resetOperations = defaultUsers.map(async (defaultUser) => {
    const user = await UserModel.findOne({ email: defaultUser.email });

    if (!user) {
      return null;
    }

    user.tokenVersion += 1;
    user.lastActiveAt = null;
    await user.save();

    return user;
  });

  await Promise.all(resetOperations);
  await seedDefaultUsers();
};
