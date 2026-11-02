import "dotenv/config";
import { runJobs } from "../src/server/jobs";
import { db } from "../src/server/db";
const once = process.argv.includes("--once");
do {
  await runJobs(20);
  if (!once) await new Promise((resolve) => setTimeout(resolve, 5000));
} while (!once);
await db.$disconnect();
