import { Router } from "express";
import { Role } from "@er-triage/shared";
import { getSystemOverview, putBedConfiguration, resetSystem } from "../controllers/system.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

const systemRouter = Router();

systemRouter.get("/overview", requireAuth, requireRole(Role.Doctor, Role.Nurse), getSystemOverview);
systemRouter.put("/beds", requireAuth, requireRole(Role.Doctor), putBedConfiguration);
systemRouter.post("/reset", requireAuth, requireRole(Role.Doctor), resetSystem);

export { systemRouter };
