import { asyncHandler } from "../utils/async-handler";
import { authenticateUser } from "../services/auth.service";
import { ApiError } from "../utils/api-error";

export const login = asyncHandler(async (request, response) => {
  const { email, password } = request.body as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const result = await authenticateUser(email, password);

  response.status(200).json(result);
});

export const getCurrentUser = asyncHandler(async (request, response) => {
  if (!request.user) {
    throw new ApiError(401, "Unauthorized");
  }

  response.status(200).json({
    id: request.user.id,
    email: request.user.email,
    role: request.user.role,
  });
});
