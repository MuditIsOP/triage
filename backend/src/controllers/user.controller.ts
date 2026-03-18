import { asyncHandler } from "../utils/async-handler";
import { ApiError } from "../utils/api-error";
import { createNurse, listNurses, removeNurse } from "../services/user.service";

export const getNurses = asyncHandler(async (_request, response) => {
  const nurses = await listNurses();
  response.status(200).json({
    nurses: nurses.map((nurse) => ({
      id: nurse.id,
      name: nurse.name,
      email: nurse.email,
      isDefaultAccount: nurse.isDefaultAccount,
      createdAt: nurse.createdAt,
    })),
  });
});

export const postNurse = asyncHandler(async (request, response) => {
  if (!request.user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { name, email, password } = request.body as {
    name?: string;
    email?: string;
    password?: string;
  };

  if (!name || !email || !password) {
    throw new ApiError(400, "Name, email, and password are required");
  }

  const nurse = await createNurse({
    name,
    email,
    password,
    createdBy: request.user.id,
  });

  response.status(201).json({
    nurse: {
      id: nurse.id,
      name: nurse.name,
      email: nurse.email,
      isDefaultAccount: nurse.isDefaultAccount,
    },
  });
});

export const deleteNurse = asyncHandler(async (request, response) => {
  if (!request.user) {
    throw new ApiError(401, "Unauthorized");
  }

  await removeNurse({
    nurseId: String(request.params.nurseId),
    removedBy: request.user.id,
  });

  response.status(200).json({
    message: "Nurse removed successfully",
  });
});
