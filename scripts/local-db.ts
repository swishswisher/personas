// Development-only PostgreSQL WASM server. Production always uses PostgreSQL over TCP.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
mkdirSync(".data", { recursive: true });
const db = await PGlite.create(".data/postgres-wasm");
const server = new PGLiteSocketServer({ db, port: 55432, host: "127.0.0.1" });
await server.start();
if (existsSync(".env") && !existsSync(".env.neon"))
  writeFileSync(".env.neon", readFileSync(".env"), { mode: 0o600 });
if (!existsSync(".env.local-db"))
  writeFileSync(
    ".env.local-db",
    `DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable"\nBETTER_AUTH_SECRET="${randomBytes(48).toString("base64url")}"\nBETTER_AUTH_URL="http://localhost:3100"\nAPP_URL="http://localhost:3100"\nFILE_STORAGE="local"\nLOCAL_EMAIL_CAPTURE="true"\n`,
    { mode: 0o600 },
  );
writeFileSync(".env", readFileSync(".env.local-db"), { mode: 0o600 });
console.log("Development PostgreSQL (PGlite) ready on 127.0.0.1:55432.");
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  });
