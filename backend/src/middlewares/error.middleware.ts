import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error";

export const notFoundHandler = (_request: Request, response: Response) => {
  response.status(404).json({
    message: "Route not found",
  });
};

export const errorHandler = (
  error: Error,
  _request: Request,
  response: Response,
  _next: NextFunction,
) => {
  if (error instanceof ApiError) {
    response.status(error.statusCode).json({
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    });
    return;
  }

  response.status(500).json({
    message: "Internal server error",
  });
};
