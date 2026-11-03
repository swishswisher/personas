import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { config } from "dotenv";
import { migrateSqlDatabase } from "./migrate-sql";
await mkdir(".data", { recursive: true });
config({ path: ".env.local-db", override: true });
process.env.NEXT_TELEMETRY_DISABLED ||= "1";
const connection = new URL(process.env.DATABASE_URL || "");
if (
  !["127.0.0.1", "localhost"].includes(connection.hostname) ||
  connection.port !== "55432" ||
  connection.pathname !== "/postgres"
)
  throw new Error(
    "dev:local requires the isolated .env.local-db connection. Run npm run db:local once first.",
  );
const pg = await PGlite.create(".data/postgres-wasm");
const server = new PGLiteSocketServer({
  db: pg,
  port: 55432,
  host: "127.0.0.1",
  maxConnections: 20,
});
await server.start();
await migrateSqlDatabase(connection.toString());
const next = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3100",
  ],
  { stdio: "inherit", env: process.env },
);
const { runJobs } = await import("../src/server/jobs");
let current: Promise<unknown> | null = null;
const interval = setInterval(() => {
  if (current) return;
  current = runJobs(10)
    .catch(() => {})
    .finally(() => {
      current = null;
    });
}, 3000);
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, async () => {
    clearInterval(interval);
    next.kill(signal);
    await current;
    const { db } = await import("../src/server/db");
    await db.$disconnect();
    await server.stop();
    await pg.close();
    process.exit(0);
  });
await new Promise<void>((resolve) => next.on("exit", () => resolve()));
