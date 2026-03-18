import { Router } from "express";
import { Role } from "@er-triage/shared";
import { deleteNurse, getNurses, postNurse } from "../controllers/user.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

const userRouter = Router();

userRouter.get("/nurses", requireAuth, requireRole(Role.Doctor), getNurses);
userRouter.post("/nurses", requireAuth, requireRole(Role.Doctor), postNurse);
userRouter.delete("/nurses/:nurseId", requireAuth, requireRole(Role.Doctor), deleteNurse);

export { userRouter };
