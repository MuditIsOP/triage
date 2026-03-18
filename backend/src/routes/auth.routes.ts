import { Router } from "express";
import { getCurrentUser, login } from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const authRouter = Router();

authRouter.post("/login", login);
authRouter.get("/me", requireAuth, getCurrentUser);

export { authRouter };
