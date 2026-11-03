import { Client } from "pg";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function migrateSqlDatabase(
  url: string,
  directory = fileURLToPath(new URL("../prisma/migrations", import.meta.url)),
) {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  let locked = false;
  try {
    await client.query("SET lock_timeout = '15s'");
    await client.query("SELECT pg_advisory_lock(1683457, 1)");
    locked = true;
    await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      id varchar(36) PRIMARY KEY, checksum varchar(64) NOT NULL, finished_at timestamptz,
      migration_name varchar(255) NOT NULL, logs text, rolled_back_at timestamptz,
      started_at timestamptz NOT NULL DEFAULT now(), applied_steps_count integer NOT NULL DEFAULT 0)`);
    const directories = (await readdir(directory, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    const rows = await client.query<{
      migration_name: string;
      checksum: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
    }>(
      'SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations" ORDER BY started_at',
    );
    for (const row of rows.rows) {
      if (row.rolled_back_at) continue;
      if (!row.finished_at)
        throw new Error(
          `Migration ${row.migration_name} has an unfinished attempt. Inspect and resolve it before retrying.`,
        );
      if (!directories.includes(row.migration_name))
        throw new Error(
          `Database contains unknown migration ${row.migration_name}. Refusing an older checkout.`,
        );
    }
    let applied = 0;
    for (const name of directories) {
      const sql = await readFile(`${directory}/${name}/migration.sql`, "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const previous = rows.rows.find(
        (r) => r.migration_name === name && !r.rolled_back_at,
      );
      if (previous) {
        if (previous.checksum !== checksum)
          throw new Error(
            `Applied migration ${name} has changed. Refusing checksum mismatch.`,
          );
        continue;
      }
      const id = randomUUID();
      await client.query(
        'INSERT INTO "_prisma_migrations" (id,checksum,migration_name) VALUES ($1,$2,$3)',
        [id, checksum, name],
      );
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          'UPDATE "_prisma_migrations" SET finished_at=now(),applied_steps_count=1 WHERE id=$1',
          [id],
        );
        await client.query("COMMIT");
        applied++;
      } catch (error) {
        await client.query("ROLLBACK");
        await client.query(
          'UPDATE "_prisma_migrations" SET logs=$2 WHERE id=$1',
          [
            id,
            error instanceof Error
              ? error.message.slice(0, 1000)
              : "Migration failed",
          ],
        );
        throw new Error(
          `Migration ${name} failed and was rolled back. Inspect its recorded failure before retrying.`,
        );
      }
    }
    return { applied };
  } finally {
    if (locked)
      await client
        .query("SELECT pg_advisory_unlock(1683457, 1)")
        .catch(() => {});
    await client.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await import("dotenv/config");
  const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!url)
    throw new Error(
      "Set an explicit direct PostgreSQL connection URL before applying migrations.",
    );
  console.log(await migrateSqlDatabase(url));
}
