import { createApp } from "./app";
import { connectToDatabase } from "./config/database";
import { env } from "./config/env";
import { seedDefaultUsers } from "./services/seed.service";
import { getOrCreateSystemConfig } from "./services/system.service";
import { startSimulationEngine } from "./services/simulation.service";

const startServer = async () => {
  try {
    await connectToDatabase();

    if (env.SEED_ENABLED) {
      await seedDefaultUsers();
    }

    const systemConfig = await getOrCreateSystemConfig();

    const app = createApp();

    app.listen(env.PORT, () => {
      console.log(`Backend listening on http://localhost:${env.PORT}`);
    });

    if (systemConfig.simulationEnabled) {
      startSimulationEngine(systemConfig.simulationTickSeconds);
    }
  } catch (error) {
    console.error("Backend startup failed", error);
    process.exit(1);
  }
};

void startServer();
