import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@er-triage/shared";
import { verifyAuthToken } from "../services/auth.service";
import { UserModel } from "../models/user.model";
import { ApiError } from "../utils/api-error";

const INACTIVITY_TIMEOUT_MS = 8 * 60 * 60 * 1000;

const getBearerToken = (request: Request) => {
  const authorizationHeader = request.headers.authorization;

  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new ApiError(401, "Authorization header is missing or invalid");
  }

  return authorizationHeader.replace("Bearer ", "");
};

export const requireAuth = async (request: Request, _response: Response, next: NextFunction) => {
  try {
    const token = getBearerToken(request);
    const payload = verifyAuthToken(token);
    const user = await UserModel.findById(payload.user_id);

    if (!user) {
      throw new ApiError(401, "Session expired or invalid. Please login again.");
    }

    if (user.tokenVersion !== payload.token_version) {
      throw new ApiError(401, "System has been reset by administrator");
    }

    if (!Object.values(Role).includes(user.role as Role)) {
      throw new ApiError(403, "Invalid role assigned to user");
    }

    if (!Object.values(Role).includes(payload.role) || payload.role !== user.role) {
      throw new ApiError(401, "Session expired or invalid. Please login again.");
    }

    if (user.lastActiveAt && Date.now() - new Date(user.lastActiveAt).getTime() > INACTIVITY_TIMEOUT_MS) {
      throw new ApiError(401, "Session expired or invalid. Please login again.");
    }

    user.lastActiveAt = new Date();
    await user.save();

    request.user = user;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
      return;
    }

    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      next(new ApiError(401, "Invalid or expired token"));
      return;
    }

    next(error);
  }
};

export const requireRole =
  (...roles: Role[]) =>
  (request: Request, _response: Response, next: NextFunction) => {
    if (!request.user) {
      next(new ApiError(401, "Unauthorized"));
      return;
    }

    if (!roles.includes(request.user.role as Role)) {
      next(new ApiError(403, "You do not have permission to access this resource"));
      return;
    }

    next();
  };

export const requireDoctor = requireRole(Role.Doctor);
export const requireNurse = requireRole(Role.Doctor, Role.Nurse);
export const requireViewer = requireRole(Role.Doctor, Role.Nurse, Role.Viewer);
