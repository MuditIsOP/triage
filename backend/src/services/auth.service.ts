import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Role } from "@er-triage/shared";
import { env } from "../config/env";
import { UserModel } from "../models/user.model";
import { ApiError } from "../utils/api-error";

type AuthTokenPayload = {
  user_id: string;
  role: Role;
  token_version: number;
};

export const hashPassword = async (password: string) => bcrypt.hash(password, 10);

export const verifyPassword = async (password: string, passwordHash: string) =>
  bcrypt.compare(password, passwordHash);

export const signAuthToken = (payload: AuthTokenPayload) =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

export const verifyAuthToken = (token: string) =>
  jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload & jwt.JwtPayload;

export const authenticateUser = async (email: string, password: string) => {
  const user = await UserModel.findOne({ email: email.toLowerCase() });

  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const passwordIsValid = await verifyPassword(password, user.passwordHash);

  if (!passwordIsValid) {
    throw new ApiError(401, "Invalid email or password");
  }

  user.lastActiveAt = new Date();
  await user.save();

  const token = signAuthToken({
    user_id: user.id,
    role: user.role as Role,
    token_version: user.tokenVersion,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  };
};
