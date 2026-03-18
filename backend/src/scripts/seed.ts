import { connectToDatabase } from "../config/database";
import { seedDefaultUsers } from "../services/seed.service";

const run = async () => {
  await connectToDatabase();
  await seedDefaultUsers();
  console.log("Default users seeded successfully.");
  process.exit(0);
};

void run();
