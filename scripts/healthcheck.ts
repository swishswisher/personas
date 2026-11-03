import "dotenv/config";
import { db } from "../src/server/db";
import { emailReady } from "../src/server/config";
const database = await db.$queryRaw`SELECT 1 AS ok`
  .then(() => true)
  .catch(() => false);
const result = {
  database,
  email: emailReady(),
  privateStorage:
    (process.env.FILE_STORAGE === "s3" && !!process.env.S3_BUCKET) ||
    (process.env.FILE_STORAGE === "database" &&
      Buffer.from(process.env.FILE_ENCRYPTION_KEY || "", "base64").length ===
        32),
  google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  ai: !!process.env.AI_MODEL && !!process.env.AI_GATEWAY_API_KEY,
  billing:
    !!process.env.STRIPE_SECRET_KEY &&
    !!process.env.STRIPE_WEBHOOK_SECRET &&
    !!process.env.STRIPE_PRICE_STARTER &&
    !!process.env.STRIPE_PRICE_TEAM &&
    !!process.env.STRIPE_PRICE_AGENCY,
  workerAuthentication: !!process.env.CRON_SECRET,
  scanner: !!(process.env.UPLOAD_SCAN_URL && process.env.UPLOAD_SCAN_TOKEN),
};
console.log(JSON.stringify(result, null, 2));
await db.$disconnect();
// Optional AI must not make an otherwise configured manual service unhealthy.
const optional = new Set([
  "ai",
  "google",
  ...(process.env.STRIPE_SECRET_KEY ? [] : ["billing"]),
]);
if (Object.entries(result).some(([key, value]) => !optional.has(key) && !value))
  process.exitCode = 1;
