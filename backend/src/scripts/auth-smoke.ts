import assert from "node:assert/strict";
import mongoose from "mongoose";
import supertest from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Role } from "@er-triage/shared";

const run = async () => {
  const mongoServer = await MongoMemoryServer.create();

  process.env.PORT = "5000";
  process.env.MONGO_URI = mongoServer.getUri();
  process.env.JWT_SECRET = "smoke-test-secret";
  process.env.XAI_API_KEY = "smoke-test-xai-key";
  process.env.XAI_BASE_URL = "https://api.x.ai/v1";
  process.env.XAI_MODEL = "grok-3";
  process.env.SEED_ENABLED = "false";

  const [{ connectToDatabase }, { createApp }, { seedDefaultUsers }, { UserModel }, { hashPassword }] =
    await Promise.all([
      import("../config/database"),
      import("../app"),
      import("../services/seed.service"),
      import("../models/user.model"),
      import("../services/auth.service"),
    ]);

  await connectToDatabase();
  await seedDefaultUsers();

  const viewerPasswordHash = await hashPassword("Viewer@123");
  await UserModel.create({
    name: "Default Viewer",
    email: "viewer@er.com",
    passwordHash: viewerPasswordHash,
    role: Role.Viewer,
  });

  const app = createApp();
  const request = supertest(app);

  const doctorLogin = await request.post("/api/auth/login").send({
    email: "doctor@er.com",
    password: "Doctor@123",
  });

  assert.equal(doctorLogin.status, 200);
  assert.equal(doctorLogin.body.user.role, Role.Doctor);
  assert.ok(doctorLogin.body.token);

  const doctorToken = doctorLogin.body.token as string;

  const meRoute = await request.get("/api/auth/me").set("Authorization", `Bearer ${doctorToken}`);

  assert.equal(meRoute.status, 200);
  assert.equal(meRoute.body.email, "doctor@er.com");
  assert.equal(meRoute.body.role, Role.Doctor);

  const doctorRoute = await request
    .get("/api/test/doctor")
    .set("Authorization", `Bearer ${doctorToken}`);

  assert.equal(doctorRoute.status, 200);

  const nurseLogin = await request.post("/api/auth/login").send({
    email: "nurse@er.com",
    password: "Nurse@123",
  });

  assert.equal(nurseLogin.status, 200);
  assert.equal(nurseLogin.body.user.role, Role.Nurse);

  const nurseDoctorRoute = await request
    .get("/api/test/doctor")
    .set("Authorization", `Bearer ${nurseLogin.body.token as string}`);

  assert.equal(nurseDoctorRoute.status, 403);

  const nurseRoute = await request
    .get("/api/test/nurse")
    .set("Authorization", `Bearer ${nurseLogin.body.token as string}`);

  assert.equal(nurseRoute.status, 200);

  const viewerLogin = await request.post("/api/auth/login").send({
    email: "viewer@er.com",
    password: "Viewer@123",
  });

  assert.equal(viewerLogin.status, 200);
  assert.equal(viewerLogin.body.user.role, Role.Viewer);

  const viewerRoute = await request
    .get("/api/test/viewer")
    .set("Authorization", `Bearer ${viewerLogin.body.token as string}`);

  assert.equal(viewerRoute.status, 200);

  const viewerNurseRoute = await request
    .get("/api/test/nurse")
    .set("Authorization", `Bearer ${viewerLogin.body.token as string}`);

  assert.equal(viewerNurseRoute.status, 403);

  const invalidTokenRoute = await request
    .get("/api/test/viewer")
    .set("Authorization", "Bearer invalid-token");

  assert.equal(invalidTokenRoute.status, 401);

  await mongoose.disconnect();
  await mongoServer.stop();

  console.log("Auth smoke test passed.");
};

void run();
