import { asyncHandler } from "../utils/async-handler";
import { ApiError } from "../utils/api-error";

const getUserFromRequest = (request: Express.Request) => {
  if (!request.user) {
    throw new ApiError(401, "Unauthorized");
  }

  return request.user;
};

export const getDoctorTest = asyncHandler(async (request, response) => {
  const user = getUserFromRequest(request);

  response.status(200).json({
    message: "Doctor access granted",
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });
});

export const getNurseTest = asyncHandler(async (request, response) => {
  const user = getUserFromRequest(request);

  response.status(200).json({
    message: "Nurse-level access granted",
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });
});

export const getViewerTest = asyncHandler(async (request, response) => {
  const user = getUserFromRequest(request);

  response.status(200).json({
    message: "Viewer-level access granted",
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });
});
