import "dotenv/config";
import { db } from "../src/server/db";
import { emailReady } from "../src/server/config";
const database = await db.$queryRaw`SELECT 1 AS ok`
  .then(() => true)
  .catch(() => false);
const result = {
  database,
  email: emailReady(),
  privateStorage: process.env.FILE_STORAGE === "s3" && !!process.env.S3_BUCKET,
  ai: !!process.env.AI_MODEL && !!process.env.AI_GATEWAY_API_KEY,
  billing:
    !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET,
  workerAuthentication: !!process.env.CRON_SECRET,
};
console.log(JSON.stringify(result, null, 2));
await db.$disconnect();
if (Object.values(result).some((v) => !v)) process.exitCode = 1;
