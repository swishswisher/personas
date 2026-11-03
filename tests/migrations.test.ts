import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "pg";
import { testDatabase } from "../scripts/test-database";
import { migrateSqlDatabase } from "../scripts/migrate-sql";

describe("deployment SQL migration safety", () => {
  it("applies the real application schema, integrity triggers and encrypted-object migration", async () => {
    const database = await testDatabase(55671, { migrate: false });
    const client = new Client({ connectionString: database.url });
    try {
      await client.connect();
      expect((await migrateSqlDatabase(database.url)).applied).toBe(3);
      expect((await migrateSqlDatabase(database.url)).applied).toBe(0);
      expect(
        (
          await client.query(
            'SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name',
          )
        ).rows.map((r) => r.migration_name),
      ).toEqual([
        "202611020001_initial",
        "202611020002_integrity_privacy",
        "202611030001_private_objects",
      ]);
      expect(
        (
          await client.query(
            "SELECT to_regclass('public.\"PrivateObject\"') AS name",
          )
        ).rows[0].name,
      ).toBeTruthy();
      expect(
        (
          await client.query(
            "SELECT count(*)::int AS count FROM pg_trigger WHERE tgname='immutable_audit'",
          )
        ).rows[0].count,
      ).toBe(1);
    } finally {
      await client.end();
      await database.close();
    }
  });
  it("serializes concurrent runs, preserves checksums, and rolls back failed migrations", async () => {
    const database = await testDatabase(55670, { migrate: false });
    const directory = await mkdtemp(join(tmpdir(), "personas-migrations-"));
    const client = new Client({ connectionString: database.url });
    try {
      await client.connect();
      await mkdir(join(directory, "001"));
      const path = join(directory, "001", "migration.sql");
      const original =
        'CREATE TABLE "MigrationFixture" (id integer PRIMARY KEY);';
      await writeFile(path, original);
      // PGlite has one backend and does not model independent session locks.
      // Native PostgreSQL runs verify the concurrent advisory-lock boundary.
      const results = process.env.PERSONAS_NATIVE_TEST_URL
        ? await Promise.all([
            migrateSqlDatabase(database.url, directory),
            migrateSqlDatabase(database.url, directory),
          ])
        : [
            await migrateSqlDatabase(database.url, directory),
            await migrateSqlDatabase(database.url, directory),
          ];
      expect(results.reduce((sum, result) => sum + result.applied, 0)).toBe(1);
      expect(
        (
          await client.query(
            'SELECT count(*)::int AS count FROM "_prisma_migrations"',
          )
        ).rows[0].count,
      ).toBe(1);
      await writeFile(path, original + "\n-- altered");
      await expect(migrateSqlDatabase(database.url, directory)).rejects.toThrow(
        "checksum mismatch",
      );
      await writeFile(path, original);
      await mkdir(join(directory, "002"));
      await writeFile(
        join(directory, "002", "migration.sql"),
        'CREATE TABLE "RolledBackFixture" (id integer); SELECT * FROM "MissingMigrationTable";',
      );
      await expect(migrateSqlDatabase(database.url, directory)).rejects.toThrow(
        "rolled back",
      );
      expect(
        (
          await client.query(
            "SELECT to_regclass('public.\"RolledBackFixture\"') AS name",
          )
        ).rows[0].name,
      ).toBeNull();
      await expect(migrateSqlDatabase(database.url, directory)).rejects.toThrow(
        "unfinished attempt",
      );
    } finally {
      await client.end();
      await database.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
