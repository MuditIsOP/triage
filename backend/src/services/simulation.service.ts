import { processSimulationTick } from "./patient.service";

let intervalHandle: NodeJS.Timeout | null = null;
let tickInFlight = false;

export const startSimulationEngine = (tickSeconds: number) => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
  }

  intervalHandle = setInterval(async () => {
    if (tickInFlight) {
      return;
    }

    tickInFlight = true;

    try {
      await processSimulationTick();
    } catch (error) {
      console.error("Simulation tick failed", error);
    } finally {
      tickInFlight = false;
    }
  }, tickSeconds * 1000);
};

export const stopSimulationEngine = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
};
