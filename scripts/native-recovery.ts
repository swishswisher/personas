import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { Client } from "pg";
import { testDatabase } from "./test-database";

if (!process.env.PERSONAS_NATIVE_TEST_URL)
  throw new Error(
    "Set PERSONAS_NATIVE_TEST_URL to the isolated local personas_test server.",
  );
const database = await testDatabase(0);
const sourceUrl = new URL(database.url);
const databaseName = sourceUrl.pathname.slice(1);
const restoredName = databaseName + "_restored";
const container =
  process.env.PERSONAS_TEST_CONTAINER || "personas-verification-postgres";
assert.match(container, /^personas-[a-z0-9-]+$/);
const backup = `/tmp/${databaseName}.dump`;
const dockerEnv = { ...process.env };
for (const key of [
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete dockerEnv[key];
function containerScript(script: string, variables: Record<string, string>) {
  return execFileSync(
    "docker",
    [
      "--host=unix:///var/run/docker.sock",
      "exec",
      "-i",
      ...Object.entries(variables).flatMap(([k, v]) => ["--env", `${k}=${v}`]),
      container,
      "bash",
    ],
    { input: script, encoding: "utf8", env: dockerEnv },
  );
}
const admin = new Client({
  connectionString: process.env.PERSONAS_NATIVE_TEST_URL,
});
await admin.connect();
Object.assign(process.env, {
  DATABASE_URL: database.url,
  FILE_STORAGE: "local",
  LOCAL_STORAGE_DIR: ".data/native-recovery-files",
  LOCAL_EMAIL_CAPTURE: "true",
  APP_URL: "http://127.0.0.1:3100",
});
const { db } = await import("../src/server/db");
const { command } = await import("../src/server/commands");
const { runJobs } = await import("../src/server/jobs");
const { putFile, getFile, deleteFile } = await import("../src/server/storage");
const checks: string[] = [];
try {
  const owner = {
    id: "recovery-owner",
    name: "Recovery fixture",
    email: "recovery@fixture.example",
    emailVerified: true,
  };
  await db.user.create({ data: owner });
  const workspace = await db.workspace.create({
    data: {
      name: "Isolated recovery fixture",
      memberships: { create: { userId: owner.id, role: "owner" } },
      subscription: { create: {} },
    },
  });
  const project = await db.project.create({
    data: { workspaceId: workspace.id, name: "Recovery project" },
  });
  const fileKey = "research/recovery/" + databaseName;
  const text = "Retain the exact recovery evidence.";
  await putFile(fileKey, Buffer.from(text), "text/plain");
  const source = await db.researchSource.create({
    data: {
      workspaceId: workspace.id,
      projectId: project.id,
      title: "Recovery record",
      kind: "upload",
      text,
      fileKey,
      fileName: "recovery.txt",
      mime: "text/plain",
      tags: [],
      classification: "finding",
    },
  });
  const observation = (await command(owner, workspace.id, {
    action: "observation.create",
    sourceId: source.id,
    quote: text,
    start: 0,
    insight: "Retain exact evidence.",
    classification: "finding",
    tags: [],
  })) as { id: string };
  const persona = (await command(owner, workspace.id, {
    action: "persona.save",
    projectId: project.id,
    content: {
      name: "Recovery audience",
      subtitle: "",
      summary: "Local recovery fixture",
      classification: "finding",
      claims: [
        {
          id: "goal",
          section: "goal",
          text: "Retain exact evidence.",
          classification: "finding",
          observationIds: [observation.id],
          assumptions: "",
        },
      ],
    },
  })) as { id: string; version: number };
  for (const type of ["submit", "approve"])
    await command(owner, workspace.id, {
      action: "persona.review",
      personaId: persona.id,
      version: persona.version,
      type,
    });
  const published = (await command(owner, workspace.id, {
    action: "publish",
    personaId: persona.id,
    version: persona.version,
    days: 1,
    membersOnly: false,
  })) as { snapshotId: string; url: string };
  await command(owner, workspace.id, {
    action: "export.create",
    snapshotId: published.snapshotId,
    format: "pdf",
  });
  await runJobs(20);
  const exp = await db.exportJob.findFirstOrThrow({
    where: { snapshotId: published.snapshotId },
  });
  assert.equal(exp.status, "ready");
  const objectBackup = await getFile(fileKey);
  const exportBackup = await getFile(exp.fileKey!);
  checks.push(
    "Native fixture persisted evidence, immutable revision, approval, share and private PDF",
  );
  console.log(
    containerScript(await readFile("scripts/backup.sh", "utf8"), {
      DIRECT_DATABASE_URL: `postgresql://personas_test@127.0.0.1/${databaseName}`,
      BACKUP_PATH: backup,
    }),
  );
  await admin.query(`CREATE DATABASE "${restoredName}"`);
  const restoreScript = await readFile("scripts/restore-check.sh", "utf8");
  const variables = {
    RESTORE_DATABASE_URL: `postgresql://personas_test@127.0.0.1/${restoredName}`,
    BACKUP_PATH: backup,
    RESTORE_CONFIRM: "isolated-empty-database",
  };
  console.log(containerScript(restoreScript, variables));
  checks.push(
    "Repository pg_dump/pg_restore runbooks restored a fresh native PostgreSQL database",
  );
  let refused = false;
  try {
    containerScript(restoreScript, variables);
  } catch {
    refused = true;
  }
  assert(refused, "Restore must refuse a populated target");
  checks.push("Repeat restore refused its nonempty target");
  await deleteFile(fileKey);
  await deleteFile(exp.fileKey!);
  await putFile(fileKey, objectBackup, "text/plain");
  await putFile(exp.fileKey!, exportBackup, "application/pdf");
  assert.deepEqual(await getFile(fileKey), objectBackup);
  assert.deepEqual(await getFile(exp.fileKey!), exportBackup);
  checks.push(
    "Private source and export objects restored byte-for-byte from isolated copies",
  );
  sourceUrl.pathname = "/" + restoredName;
  const fixturePath = `.data/recovery/${databaseName}.json`;
  await mkdir(".data/recovery", { recursive: true });
  await writeFile(
    fixturePath,
    JSON.stringify({
      owner,
      workspaceId: workspace.id,
      projectId: project.id,
      sourceId: source.id,
      personaId: persona.id,
      shareToken: published.url.split("/").at(-1),
      exportId: exp.id,
      text,
    }),
    { mode: 0o600 },
  );
  execFileSync(
    process.execPath,
    ["--import", "tsx", "scripts/recovery-probe.ts", fixturePath],
    {
      env: { ...process.env, DATABASE_URL: sourceUrl.toString() },
      stdio: "inherit",
    },
  );
  checks.push(
    "Restored runtime verified access denial, evidence, history, immutable revision, share and private files",
  );
  await writeFile(
    "docs/evidence/native-recovery.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        engine: "PostgreSQL 17 native, official postgres:17-bookworm container",
        checks,
        limitations: [
          "Isolated local fixture and local private objects, not customer data, encrypted offsite storage or managed-provider PITR.",
          "Native Prisma migrate deploy remains blocked by the engine-download policy; committed SQL migrations were applied to disposable databases.",
        ],
      },
      null,
      2,
    ),
  );
  for (const check of checks) console.log("PASS", check);
} finally {
  await db.$disconnect();
  await admin.query(`DROP DATABASE IF EXISTS "${restoredName}" WITH (FORCE)`);
  await admin.end();
  await database.close();
  containerScript(`rm -f '${backup}' '${backup}.manifest'`, {});
}
