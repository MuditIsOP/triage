import { Role } from "@er-triage/shared";
import { asyncHandler } from "../utils/async-handler";
import { ApiError } from "../utils/api-error";
import {
  applyDoctorOverride,
  clearDoctorOverride,
  createPatient,
  createQuickEntryPatient,
  deletePatientRecord,
  generateDemoPatients,
  getPatientDetails,
  getPatientGuidance,
  listPatientAnalytics,
  listQueuePatients,
  previewPatientIntake,
  updatePatientRecord,
  updatePatientStatus,
} from "../services/patient.service";
import { PatientGuidancePromptKey } from "@er-triage/shared";

const requireUser = (request: Express.Request) => {
  if (!request.user) {
    throw new ApiError(401, "Unauthorized");
  }

  return request.user;
};

export const getPatients = asyncHandler(async (request, response) => {
  const user = requireUser(request);
  const patients = await listQueuePatients(user.role as Role);
  response.status(200).json({ patients });
});

export const getPatient = asyncHandler(async (request, response) => {
  const user = requireUser(request);
  const patientId = String(request.params.patientId);
  const patient = await getPatientDetails(patientId, user.role as Role);
  response.status(200).json({ patient });
});

export const postPatientGuidance = asyncHandler(async (request, response) => {
  const user = requireUser(request);
  const patientId = String(request.params.patientId);
  const promptKey = String((request.body as { promptKey?: string }).promptKey) as PatientGuidancePromptKey;

  if (!Object.values(PatientGuidancePromptKey).includes(promptKey)) {
    throw new ApiError(400, "Invalid patient guidance prompt");
  }

  const guidance = await getPatientGuidance(patientId, promptKey, user.role as Role);
  response.status(200).json({ guidance });
});

export const postIntakePreview = asyncHandler(async (request, response) => {
  requireUser(request);
  const preview = await previewPatientIntake(request.body);
  response.status(200).json(preview);
});

export const postPatient = asyncHandler(async (request, response) => {
  const user = requireUser(request);
  const patient = await createPatient(request.body, user.id);
  response.status(201).json({ patient: await getPatientDetails(patient.patientId, user.role as Role) });
});

export const postQuickEntryPatient = asyncHandler(async (request, response) => {
  const user = requireUser(request);
  const patient = await createQuickEntryPatient(request.body, user.id);
  response.status(201).json({ patient: await getPatientDetails(patient.patientId, user.role as Role) });
});

export const patchPatient = asyncHandler(async (request, response) => {
  const user = requireUser(request);
  const patientId = String(request.params.patientId);
  const patient = await updatePatientRecord(patientId, request.body, user.id, user.role as Role);
  response.status(200).json({ patient: await getPatientDetails(patient.patientId, user.role as Role) });
});

export const patchPatientStatus = asyncHandler(async (request, response) => {
  const user = requireUser(request);
  const patientId = String(request.params.patientId);
  const patient = await updatePatientStatus(patientId, request.body, user.id, user.role as Role);
  response.status(200).json({ patient: await getPatientDetails(patient.patientId, user.role as Role) });
});

export const patchDoctorOverride = asyncHandler(async (request, response) => {
  const user = requireUser(request);
  const patientId = String(request.params.patientId);
  const patient = await applyDoctorOverride(patientId, request.body, user.id);
  response.status(200).json({ patient: await getPatientDetails(patient.patientId, user.role as Role) });
});

export const deleteDoctorOverride = asyncHandler(async (request, response) => {
  const user = requireUser(request);
  const version = Number((request.body as { version?: number }).version);

  if (!Number.isInteger(version)) {
    throw new ApiError(400, "Version is required");
  }

  const patientId = String(request.params.patientId);
  const patient = await clearDoctorOverride(patientId, version, user.id);
  response.status(200).json({ patient: await getPatientDetails(patient.patientId, user.role as Role) });
});

export const deletePatient = asyncHandler(async (request, response) => {
  const user = requireUser(request);
  const patientId = String(request.params.patientId);
  const result = await deletePatientRecord(patientId, user.id, user.role as Role);
  response.status(200).json({ deletedPatientId: result.patientId });
});

export const createDemoPatients = asyncHandler(async (request, response) => {
  const user = requireUser(request);
  const count = Number((request.body as { count?: number }).count);

  if (!Number.isInteger(count) || count < 1 || count > 50) {
    throw new ApiError(400, "Count must be an integer between 1 and 50");
  }

  const patients = await generateDemoPatients(count, user.id);
  response.status(201).json({ patients });
});

export const getPatientAnalytics = asyncHandler(async (_request, response) => {
  const patients = await listPatientAnalytics();
  response.status(200).json({ patients });
});
