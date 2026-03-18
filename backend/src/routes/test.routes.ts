import { Router } from "express";
import { getDoctorTest, getNurseTest, getViewerTest } from "../controllers/test.controller";
import {
  requireAuth,
  requireDoctor,
  requireNurse,
  requireViewer,
} from "../middlewares/auth.middleware";

const testRouter = Router();

testRouter.get("/doctor", requireAuth, requireDoctor, getDoctorTest);
testRouter.get("/nurse", requireAuth, requireNurse, getNurseTest);
testRouter.get("/viewer", requireAuth, requireViewer, getViewerTest);

export { testRouter };
