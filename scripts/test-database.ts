import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { Client } from "pg";
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

// Test-only opt-in. Never fall back to a configured application DATABASE_URL.
// Native runs create and remove their own random database on a local test server.
export async function testDatabase(port: number) {
  const native = process.env.PERSONAS_NATIVE_TEST_URL;
  const migrations = (
    await readdir("prisma/migrations", { withFileTypes: true })
  )
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  if (native) {
    const url = new URL(native);
    if (
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.pathname !== "/personas_test"
    )
      throw new Error(
        "PERSONAS_NATIVE_TEST_URL must point to the local disposable personas_test server, never a customer database.",
      );
    const admin = new Client({ connectionString: native });
    await admin.connect();
    const name = "personas_verify_" + randomBytes(8).toString("hex");
    await admin.query(`CREATE DATABASE "${name}"`);
    url.pathname = "/" + name;
    const client = new Client({ connectionString: url.toString() });
    try {
      await client.connect();
      for (const migration of migrations)
        await client.query(
          await readFile(
            `prisma/migrations/${migration}/migration.sql`,
            "utf8",
          ),
        );
    } catch (error) {
      await client.end();
      await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
      await admin.end();
      throw error;
    }
    await client.end();
    return {
      url: url.toString(),
      engine: "PostgreSQL 17 native",
      pg: undefined,
      async close() {
        await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
        await admin.end();
      },
    };
  }
  const pg = await PGlite.create();
  for (const migration of migrations)
    await pg.exec(
      await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8"),
    );
  const server = new PGLiteSocketServer({
    db: pg,
    port,
    host: "127.0.0.1",
    maxConnections: 30,
  });
  await server.start();
  return {
    url: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`,
    engine: "PostgreSQL WASM/PGlite over TCP",
    pg,
    async close() {
      await server.stop();
      await pg.close();
    },
  };
}
