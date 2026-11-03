import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { config } from "dotenv";
await mkdir(".data", { recursive: true });
config({ path: ".env.local-db" });
const pg = await PGlite.create(".data/postgres-wasm");
const server = new PGLiteSocketServer({
  db: pg,
  port: 55432,
  host: "127.0.0.1",
  maxConnections: 20,
});
await server.start();
const migrate = spawn(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { stdio: "inherit" },
);
await new Promise<void>((resolve, reject) =>
  migrate.on("exit", (code) =>
    code === 0 ? resolve() : reject(new Error("Migration failed")),
  ),
);
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
const interval = setInterval(() => void runJobs(10).catch(() => {}), 3000);
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, async () => {
    clearInterval(interval);
    next.kill(signal);
    await server.stop();
    await pg.close();
    process.exit(0);
  });
await new Promise<void>((resolve) => next.on("exit", () => resolve()));
