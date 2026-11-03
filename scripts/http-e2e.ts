import { testDatabase } from "./test-database";
import { writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
const origin = "http://127.0.0.1:3101";
// A future configured environment must not send fixture emails or provider calls.
for (const key of [
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "STRIPE_SECRET_KEY",
  "AI_GATEWAY_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
])
  delete process.env[key];
Object.assign(process.env, {
  DATABASE_URL:
    "postgresql://postgres:postgres@127.0.0.1:55667/postgres?sslmode=disable",
  APP_URL: origin,
  BETTER_AUTH_URL: origin,
  BETTER_AUTH_SECRET: "http-e2e-test-only-secret-012345678901234567890",
  LOCAL_EMAIL_CAPTURE: "true",
  ALLOW_LOCAL_STORAGE: "true",
  FILE_STORAGE: process.env.PERSONAS_TEST_FILE_STORAGE || "local",
  FILE_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  JOB_EXECUTION: process.env.PERSONAS_TEST_JOB_EXECUTION || "manual",
  LOCAL_STORAGE_DIR: ".data/http-files",
  CRON_SECRET: "http-fixture-worker-secret",
  UPLOAD_SCAN_URL: "http://127.0.0.1:55668/scan",
  UPLOAD_SCAN_TOKEN: "fixture-scanner-token",
});
// Contract stub for the scanner boundary; this is not a real malware scanner.
let scannerAccept = true;
const scanner = createServer((request, response) => {
  const chunks: Buffer[] = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", async () => {
    response.setHeader("Content-Type", "application/json");
    if (scannerAccept && process.env.PERSONAS_REAL_SCAN_URL) {
      try {
        const result = await fetch(process.env.PERSONAS_REAL_SCAN_URL, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + process.env.PERSONAS_REAL_SCAN_TOKEN,
            "Content-Type":
              request.headers["content-type"] || "application/octet-stream",
          },
          body: Buffer.concat(chunks),
        });
        response.statusCode = result.status;
        response.end(await result.text());
      } catch {
        response.statusCode = 503;
        response.end(JSON.stringify({ clean: false }));
      }
      return;
    }
    response.end(
      JSON.stringify({
        clean:
          scannerAccept &&
          request.headers.authorization === "Bearer fixture-scanner-token",
      }),
    );
  });
});
await new Promise<void>((resolve) =>
  scanner.listen(55668, "127.0.0.1", resolve),
);
const database = await testDatabase(55667);
process.env.DATABASE_URL = database.url;
const { db } = await import("../src/server/db");
const { runJobs } = await import("../src/server/jobs");
async function drainJobs() {
  if (process.env.JOB_EXECUTION !== "after") {
    await runJobs(30);
    return;
  }
  for (let i = 0; i < 100; i++) {
    const pending = await db.job.count({
      where: {
        OR: [
          { status: "processing" },
          {
            status: { in: ["queued", "retry"] },
            availableAt: { lte: new Date() },
          },
        ],
      },
    });
    if (!pending) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Post-response worker did not drain the active queue");
}
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3101",
  ],
  { env: process.env, stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "";
child.stdout.on("data", (x) => {
  logs += x;
});
child.stderr.on("data", (x) => {
  logs += x;
});
const evidence: { check: string; status: string; ms?: number }[] = [];
const ok = (check: string, ms?: number) => {
  evidence.push({ check, status: "passed", ...(ms ? { ms } : {}) });
  console.log("PASS", check);
};
const jar = new Map<string, string>();
async function request(
  path: string,
  data?: unknown,
  anonymous = false,
  method?: string,
) {
  const response = await fetch(origin + path, {
    method: method || (data === undefined ? "GET" : "POST"),
    headers: {
      origin,
      ...(data === undefined ? {} : { "Content-Type": "application/json" }),
      ...(!anonymous && jar.size
        ? { cookie: [...jar].map(([k, v]) => k + "=" + v).join("; ") }
        : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
    redirect: "manual",
  });
  if (!anonymous)
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0],
        at = pair.indexOf("=");
      if (at > 0) jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
  return response;
}
async function json(path: string, data?: unknown) {
  const response = await request(path, data);
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  return result;
}
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(origin)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  assert(ready, "Next.js did not start: " + logs);
  assert.equal((await fetch(origin + "/api/health")).status, 200);
  ok(
    "Database/schema health endpoint responds without exposing private configuration",
  );
  const publicPaths = [
    "/",
    "/product",
    "/solutions",
    "/solutions/agencies",
    "/solutions/product-teams",
    "/solutions/marketers",
    "/methodology",
    "/examples",
    "/resources",
    "/resources/evidence",
    "/resources/interviews",
    "/resources/living-personas",
    "/pricing",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    "/login",
    "/signup",
    "/reset",
    "/verify",
    "/invite",
    "/onboarding",
  ];
  for (const path of publicPaths) {
    const start = performance.now(),
      response = await request(path, undefined, true);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert(html.includes("<main"), path + " needs a main landmark");
    assert(
      !html.includes("NEXT_HTTP_ERROR_FALLBACK;500"),
      path + " returned an error shell",
    );
    ok("Public page " + path, Math.round(performance.now() - start));
  }
  const enquiry = await json("/api/v1/enquiries", {
    name: "HTTP Fixture",
    email: "enquiry@fixture.example",
    text: "A legitimate fixture enquiry for HTTP verification.",
  });
  assert(enquiry.id);
  ok("Enquiry persists");
  const password = "http-fixture-long-password-2026",
    email = "http-owner@fixture.example";
  await json("/api/auth/sign-up/email", {
    email,
    password,
    name: "HTTP fixture owner",
    callbackURL: "/app",
  });
  const mail = await db.job.findFirstOrThrow({
    where: { kind: "email", payload: { path: ["to"], equals: email } },
    orderBy: { createdAt: "desc" },
  });
  const verification = (mail.payload as { text: string }).text
    .split("\n")
    .at(-1)!;
  if (process.env.JOB_EXECUTION === "after") {
    await drainJobs();
    assert.equal(
      (await db.job.findUniqueOrThrow({ where: { id: mail.id } })).status,
      "complete",
    );
    ok(
      "Vercel-style after() delivered local verification capture without a manual worker",
    );
  }
  const verified = await request(verification.replace(origin, ""));
  assert([200, 302].includes(verified.status));
  await json("/api/auth/sign-in/email", { email, password });
  const me = await json("/api/v1/me");
  assert.equal(me.user.email, email);
  ok("Registration → verification → sign-in → signed session");
  const { workspaceId } = await json("/api/v1/onboarding", {
    workspaceName: "HTTP fixture workspace",
    projectName: "HTTP fixture project",
  });
  const data = await json(`/api/v1/workspaces/${workspaceId}/data`);
  const projectId = data.selectedProject;
  const command = (c: unknown) =>
    json(`/api/v1/workspaces/${workspaceId}/commands`, c);
  const source = await command({
    action: "source.create",
    projectId,
    title: "HTTP interview",
    kind: "interview",
    text: "I need the full cost before involving my team.",
    participant: "P01",
    tags: ["pricing"],
    classification: "finding",
  });
  const observation = await command({
    action: "observation.create",
    sourceId: source.id,
    quote: "the full cost",
    start: 7,
    insight: "Needs pricing clarity.",
    tags: [],
    classification: "finding",
  });
  const content = {
    name: "HTTP deliberate buyer",
    subtitle: "A test fixture",
    summary: "Fixture audience based on supplied interview evidence.",
    classification: "finding",
    claims: [
      {
        id: "goal1",
        section: "goal",
        text: "Understand the full cost before involving the team.",
        classification: "finding",
        observationIds: [observation.id],
        assumptions: "",
      },
    ],
  };
  const persona = await command({ action: "persona.save", projectId, content });
  await command({
    action: "persona.review",
    personaId: persona.id,
    version: 1,
    type: "submit",
  });
  await command({
    action: "persona.review",
    personaId: persona.id,
    version: 1,
    type: "approve",
  });
  const published = await command({
    action: "publish",
    personaId: persona.id,
    version: 1,
    days: 30,
    membersOnly: false,
  });
  const token = published.url.split("/").at(-1);
  const share = await json("/api/v1/share/" + token);
  assert.equal(share.content.name, content.name);
  ok(
    "Research → exact observation → saved persona → owner approval → immutable share",
  );
  const exportJob = await command({
    action: "export.create",
    snapshotId: published.snapshotId,
    format: "csv",
  });
  await drainJobs();
  const exported = await request(
    `/api/v1/workspaces/${workspaceId}/exports/${exportJob.id}`,
  );
  assert.equal(exported.status, 200);
  assert((await exported.text()).includes("HTTP deliberate buyer"));
  ok("Queued CSV export → private authorized download");
  const upload = new FormData();
  upload.append("projectId", projectId);
  upload.append(
    "file",
    new File(["A UTF-8 fixture interview for extraction."], "fixture.txt", {
      type: "text/plain",
    }),
  );
  const uploaded = await fetch(
    origin + `/api/v1/workspaces/${workspaceId}/upload`,
    {
      method: "POST",
      headers: {
        origin,
        cookie: [...jar].map(([k, v]) => k + "=" + v).join("; "),
      },
      body: upload,
    },
  );
  assert.equal(uploaded.status, 200);
  const uploadSource = await uploaded.json();
  await drainJobs();
  const extracted = await json(
    `/api/v1/workspaces/${workspaceId}/sources/${uploadSource.id}`,
  );
  assert.equal(extracted.status, "ready");
  assert(extracted.text.includes("UTF-8"));
  ok("Private upload → background text extraction → persisted source");
  const filePath = `/api/v1/workspaces/${workspaceId}/files/${uploadSource.id}`;
  const original = await request(filePath);
  assert.equal(original.status, 200);
  assert.equal(original.headers.get("cache-control"), "private, no-store");
  assert((await original.text()).includes("UTF-8 fixture interview"));
  assert.equal((await request(filePath, undefined, true)).status, 401);
  ok("Original private file download succeeds only with a signed session");
  const ownerCookies = new Map(jar);
  jar.clear();
  const outsiderEmail = "http-outsider@fixture.example";
  await json("/api/auth/sign-up/email", {
    email: outsiderEmail,
    password,
    name: "HTTP outsider",
  });
  const outsiderMail = await db.job.findFirstOrThrow({
    where: { kind: "email", payload: { path: ["to"], equals: outsiderEmail } },
    orderBy: { createdAt: "desc" },
  });
  await request(
    (outsiderMail.payload as { text: string }).text
      .split("\n")
      .at(-1)!
      .replace(origin, ""),
  );
  await json("/api/auth/sign-in/email", { email: outsiderEmail, password });
  const otherWorkspace = await json("/api/v1/onboarding", {
    workspaceName: "HTTP other tenant",
    projectName: "Other tenant project",
  });
  assert.equal((await request(filePath)).status, 404);
  assert.equal(
    (
      await request(
        `/api/v1/workspaces/${otherWorkspace.workspaceId}/files/${uploadSource.id}`,
      )
    ).status,
    404,
  );
  assert.equal(
    (await request(`/api/v1/workspaces/${workspaceId}/data`)).status,
    404,
  );
  assert.equal(
    (await request(`/api/v1/workspaces/${workspaceId}/exports/${exportJob.id}`))
      .status,
    410,
  );
  jar.clear();
  for (const [key, value] of ownerCookies) jar.set(key, value);
  ok(
    "Authenticated other tenant denied private source, guessed file, workspace and export URLs",
  );
  const { renderPdf } = await import("../src/server/jobs");
  const pdfBody = await renderPdf(
    {
      ...content,
      classification: "finding",
      claims: content.claims.map((cl) => ({
        ...cl,
        classification: "finding",
      })),
    } as import("../src/lib/domain").PersonaContent,
    1,
  );
  const pdfUpload = new FormData();
  pdfUpload.append("projectId", projectId);
  pdfUpload.append(
    "file",
    new File([new Uint8Array(pdfBody)], "fixture.pdf", {
      type: "application/pdf",
    }),
  );
  const pdfResponse = await fetch(
    origin + `/api/v1/workspaces/${workspaceId}/upload`,
    {
      method: "POST",
      headers: {
        origin,
        cookie: [...jar].map(([k, v]) => k + "=" + v).join("; "),
      },
      body: pdfUpload,
    },
  );
  assert.equal(pdfResponse.status, 200);
  const pdfSource = await pdfResponse.json();
  const workerResponse = await fetch(origin + "/api/jobs", {
    headers: { Authorization: "Bearer http-fixture-worker-secret" },
  });
  assert.equal(workerResponse.status, 200);
  if (process.env.JOB_EXECUTION === "after") await drainJobs();
  const pdfExtracted = await json(
    `/api/v1/workspaces/${workspaceId}/sources/${pdfSource.id}`,
  );
  assert.equal(pdfExtracted.status, "ready", pdfExtracted.failure);
  assert(pdfExtracted.text.includes("HTTP deliberate buyer"));
  ok("PDF upload → scanner contract → bundled Next.js worker extraction");
  scannerAccept = false;
  const rejectedUpload = new FormData();
  rejectedUpload.append("projectId", projectId);
  rejectedUpload.append(
    "file",
    new File([new Uint8Array(pdfBody)], "retry.pdf", {
      type: "application/pdf",
    }),
  );
  const rejectedResponse = await fetch(
    origin + `/api/v1/workspaces/${workspaceId}/upload`,
    {
      method: "POST",
      headers: {
        origin,
        cookie: [...jar].map(([k, v]) => k + "=" + v).join("; "),
      },
      body: rejectedUpload,
    },
  );
  assert.equal(rejectedResponse.status, 200);
  const rejectedSource = await rejectedResponse.json();
  await fetch(origin + "/api/jobs", {
    headers: { Authorization: "Bearer http-fixture-worker-secret" },
  });
  if (process.env.JOB_EXECUTION === "after") await drainJobs();
  const failedSource = await json(
    `/api/v1/workspaces/${workspaceId}/sources/${rejectedSource.id}`,
  );
  assert.equal(failedSource.status, "failed");
  assert.equal(
    (
      await request(
        `/api/v1/workspaces/${workspaceId}/files/${rejectedSource.id}`,
      )
    ).status,
    404,
  );
  ok(
    "Scanner rejection quarantines the PDF and denies original-file downloads",
  );
  scannerAccept = true;
  await command({ action: "source.retry", sourceId: rejectedSource.id });
  await fetch(origin + "/api/jobs", {
    headers: { Authorization: "Bearer http-fixture-worker-secret" },
  });
  if (process.env.JOB_EXECUTION === "after") await drainJobs();
  assert.equal(
    (
      await json(
        `/api/v1/workspaces/${workspaceId}/sources/${rejectedSource.id}`,
      )
    ).status,
    "ready",
  );
  assert.equal(
    await db.researchSource.count({ where: { id: rejectedSource.id } }),
    1,
  );
  ok(
    "Scanner contract recovery retries extraction without duplicating the source",
  );

  const pages = [
    "",
    "projects",
    "project",
    "research",
    "research/new",
    "research/" + source.id,
    "personas",
    "builder",
    "persona",
    "history",
    "review",
    "publish",
    "exports",
    "journeys",
    "compare",
    "ask",
    "gaps",
    "briefs",
    "team",
    "settings",
    "billing",
    "checkout",
    "support",
    "notifications",
  ];
  for (const page of pages) {
    const response = await request(
      `/app${page ? "/" + page : ""}?workspace=${workspaceId}&project=${projectId}&id=${persona.id}`,
    );
    assert.equal(response.status, 200, "Workspace " + page);
    const html = await response.text();
    assert(!html.includes("NEXT_HTTP_ERROR_FALLBACK;500"));
    ok("Authenticated page /app/" + page);
  }
  const anon = await request(
    `/api/v1/workspaces/${workspaceId}/data`,
    undefined,
    true,
  );
  assert.equal(anon.status, 401);
  const crossOrigin = await fetch(
    origin + `/api/v1/workspaces/${workspaceId}/commands`,
    {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "Content-Type": "application/json",
      },
      body: "{}",
    },
  );
  assert.equal(crossOrigin.status, 403);
  ok("Unsigned API and cross-origin mutation rejected");
  await command({ action: "share.revoke", shareId: published.shareId });
  assert.equal(
    (await request("/api/v1/share/" + token, undefined, true)).status,
    410,
  );
  ok("Revoked share denied on subsequent HTTP retrieval");
  await json("/api/auth/sign-out", {});
  assert.equal((await request("/api/v1/me")).status, 401);
  await json("/api/auth/sign-in/email", { email, password });
  const persisted = await json(
    `/api/v1/workspaces/${workspaceId}/data?project=${projectId}`,
  );
  assert.equal(persisted.personas[0].id, persona.id);
  ok("Persistence across sign-out and a new signed session");
  // Staff authorization and platform screens use a separately granted database role.
  await db.user.update({ where: { email }, data: { staffRole: "admin" } });
  for (const path of [
    "",
    "workspaces",
    "subscriptions",
    "support",
    "content",
    "audit",
  ])
    assert.equal(
      (await request("/admin" + (path ? "/" + path : ""))).status,
      200,
    );
  const admin = await json("/api/v1/admin");
  assert(admin.workspaces.some((w: { id: string }) => w.id === workspaceId));
  ok("Separate staff authorization and all six administration pages");
  await mkdir("docs/evidence", { recursive: true });
  await writeFile(
    "docs/evidence/http-e2e.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        engine: "Next.js production server + " + database.engine,
        storage: process.env.FILE_STORAGE,
        jobExecution: process.env.JOB_EXECUTION,
        realScanner: !!process.env.PERSONAS_REAL_SCAN_URL,
        checks: evidence,
        limitations: [
          "HTTP and SSR checks; browser interaction and assistive technology checks are recorded separately.",
          "No live payment, AI, email or S3 credentials were used.",
        ],
      },
      null,
      2,
    ),
  );
  console.log("HTTP E2E checks:", evidence.length);
} catch (error) {
  console.error(error);
  console.error(logs.slice(-14000));
  process.exitCode = 1;
} finally {
  child.kill("SIGTERM");
  await new Promise((r) => child.once("exit", r));
  await db.$disconnect();
  await database.close();
  await new Promise<void>((resolve) => scanner.close(() => resolve()));
}
