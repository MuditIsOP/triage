import { Router } from "express";
import { auditRouter } from "./audit.routes";
import { authRouter } from "./auth.routes";
import { patientRouter } from "./patient.routes";
import { systemRouter } from "./system.routes";
import { testRouter } from "./test.routes";
import { userRouter } from "./user.routes";

const apiRouter = Router();

apiRouter.get("/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    service: "er-triage-backend",
  });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/audit-logs", auditRouter);
apiRouter.use("/patients", patientRouter);
apiRouter.use("/system", systemRouter);
apiRouter.use("/test", testRouter);
apiRouter.use("/users", userRouter);

export { apiRouter };
