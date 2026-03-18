import { Router } from "express";
import { Role } from "@er-triage/shared";
import {
  createDemoPatients,
  deletePatient,
  deleteDoctorOverride,
  getPatient,
  getPatientAnalytics,
  getPatients,
  patchDoctorOverride,
  patchPatient,
  patchPatientStatus,
  postPatientGuidance,
  postIntakePreview,
  postPatient,
  postQuickEntryPatient,
} from "../controllers/patient.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

const patientRouter = Router();

patientRouter.get("/", requireAuth, requireRole(Role.Doctor, Role.Nurse, Role.Viewer), getPatients);
patientRouter.get("/analytics", requireAuth, requireRole(Role.Doctor), getPatientAnalytics);
patientRouter.get("/:patientId", requireAuth, requireRole(Role.Doctor, Role.Nurse), getPatient);
patientRouter.post("/:patientId/guidance", requireAuth, requireRole(Role.Doctor, Role.Nurse), postPatientGuidance);
patientRouter.post("/intake/preview", requireAuth, requireRole(Role.Doctor, Role.Nurse), postIntakePreview);
patientRouter.post("/", requireAuth, requireRole(Role.Doctor, Role.Nurse), postPatient);
patientRouter.post("/quick-entry", requireAuth, requireRole(Role.Doctor, Role.Nurse), postQuickEntryPatient);
patientRouter.post("/demo", requireAuth, requireRole(Role.Doctor, Role.Nurse), createDemoPatients);
patientRouter.patch("/:patientId", requireAuth, requireRole(Role.Doctor, Role.Nurse), patchPatient);
patientRouter.patch("/:patientId/status", requireAuth, requireRole(Role.Doctor, Role.Nurse), patchPatientStatus);
patientRouter.patch("/:patientId/override", requireAuth, requireRole(Role.Doctor), patchDoctorOverride);
patientRouter.delete("/:patientId", requireAuth, requireRole(Role.Doctor), deletePatient);
patientRouter.delete("/:patientId/override", requireAuth, requireRole(Role.Doctor), deleteDoctorOverride);

export { patientRouter };
