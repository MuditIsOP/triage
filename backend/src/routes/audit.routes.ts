import { Router } from "express";
import { getAuditLogs } from "../controllers/audit.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const auditRouter = Router();

auditRouter.get("/", requireAuth, getAuditLogs);

export { auditRouter };
