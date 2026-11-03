import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { testDatabase } from "./test-database";

// Browser tools live outside application dependencies. See docs/VERIFICATION.md.
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PERSONAS_PLAYWRIGHT_MODULE || "playwright",
);
const axePath = require.resolve(
  process.env.PERSONAS_AXE_MODULE || "axe-core/axe.min.js",
);
const origin = "http://127.0.0.1:3102";
const database = await testDatabase(55669);
Object.assign(process.env, {
  DATABASE_URL: database.url,
  APP_URL: origin,
  BETTER_AUTH_URL: origin,
  BETTER_AUTH_SECRET: randomBytes(48).toString("base64url"),
  LOCAL_EMAIL_CAPTURE: "true",
  ALLOW_LOCAL_STORAGE: "true",
  FILE_STORAGE: process.env.PERSONAS_TEST_FILE_STORAGE || "local",
  FILE_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  JOB_EXECUTION: process.env.PERSONAS_TEST_JOB_EXECUTION || "manual",
  LOCAL_STORAGE_DIR: ".data/browser-files",
  NEXT_TELEMETRY_DISABLED: "1",
  ...(process.env.PERSONAS_TEST_GOOGLE === "1"
    ? {
        GOOGLE_CLIENT_ID: "browser-fixture.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: "browser-fixture-not-a-real-secret",
      }
    : {}),
});
// Real provider operations are deliberately absent in isolated verification.
for (const key of [
  "STRIPE_SECRET_KEY",
  "AI_GATEWAY_API_KEY",
  "RESEND_API_KEY",
  "UPLOAD_SCAN_URL",
])
  delete process.env[key];
const { db } = await import("../src/server/db");
const { runJobs } = await import("../src/server/jobs");
async function drainJobs() {
  if (process.env.JOB_EXECUTION !== "after") {
    await runJobs(30);
    return;
  }
  for (let i = 0; i < 100; i++) {
    if (
      !(await db.job.count({
        where: {
          OR: [
            { status: "processing" },
            {
              status: { in: ["queued", "retry"] },
              availableAt: { lte: new Date() },
            },
          ],
        },
      }))
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Post-response jobs did not complete");
}
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3102",
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
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on(
  "dialog",
  (dialog: { accept: () => Promise<void> }) => void dialog.accept(),
);
const checks: { name: string; status: string }[] = [];
const accessibility: unknown[] = [];
const runtimeErrors: string[] = [];
page.on("pageerror", (error: Error) => runtimeErrors.push(error.message));
const passed = (name: string) => {
  checks.push({ name, status: "passed" });
  console.log("PASS", name);
};
const waitText = (text: string) =>
  page.getByText(text, { exact: false }).first().waitFor();
async function go(path: string) {
  await page.goto(origin + path);
  if (path.startsWith("/app"))
    await page
      .getByLabel("Workspace", { exact: true })
      .waitFor({ state: "attached" });
  if (path.startsWith("/admin"))
    await page
      .getByRole("navigation", {
        name: "Platform administration",
        includeHidden: true,
      })
      .waitFor({ state: "attached" });
}
async function scan(label: string) {
  await page.addScriptTag({ path: axePath });
  const result = await page.evaluate(async () => {
    // Injected test tooling, not application code.
    const axe = (
      window as unknown as {
        axe: { run: (options: unknown) => Promise<{ violations: unknown[] }> };
      }
    ).axe;
    return axe.run({
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    });
  });
  accessibility.push({ label, violations: result.violations });
  console.log("AXE", label, result.violations.length, "violations");
}
let workspaceId = "",
  projectId = "",
  personaId = "";
const href = (path: string) =>
  `/app${path ? "/" + path : ""}?workspace=${workspaceId}&project=${projectId}${personaId ? "&id=" + personaId : ""}`;
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
  assert(ready, "Production server did not start");
  await go("/");
  await scan("Public homepage desktop");
  await page.keyboard.press("Tab");
  assert.match(await page.locator(":focus").innerText(), /Skip to content/);
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(":focus").getAttribute("id"), "main");
  passed("Keyboard skip link moves focus to the main landmark");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Pricing" })
    .click();
  await page.waitForURL("**/pricing");
  await page.getByRole("heading", { name: /\$5\s*\/\s*month/ }).waitFor();
  const pricing = await page.locator("main").innerText();
  for (const amount of [5, 15, 39])
    assert.match(pricing, new RegExp("\\$" + amount + "\\s*\\/\\s*month"));
  await page.screenshot({
    path: "docs/evidence/pricing-affordable.png",
    fullPage: true,
  });
  passed("Public prices are the approved $5/$15/$39 monthly amounts");
  await scan("Pricing desktop");
  passed("Public product-to-pricing navigation");

  if (process.env.PERSONAS_TEST_GOOGLE === "1") {
    // Verify the browser redirect boundary, without pretending Google authenticated.
    await page.route(
      "https://accounts.google.com/**",
      (route: {
        fulfill: (options: Record<string, unknown>) => Promise<void>;
      }) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<h1>Google authorization boundary fixture</h1>",
        }),
    );
    await go("/login");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await page.waitForURL((url: URL) => url.hostname === "accounts.google.com");
    const authorization = new URL(page.url());
    assert.equal(
      authorization.searchParams.get("client_id"),
      "browser-fixture.apps.googleusercontent.com",
    );
    assert(authorization.searchParams.get("state"));
    passed(
      "Google browser button starts state-protected OAuth (provider boundary fixture, not a real Google login)",
    );
  }

  await go("/signup");
  await page.getByLabel("Your name").fill("Browser owner");
  const email = "browser-owner@fixture.example",
    password = "browser-fixture-password-2026";
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel(/^Password(?:\s|$)/).fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await waitText("Account created.");
  const mail = await db.job.findFirstOrThrow({
    where: { kind: "email", payload: { path: ["to"], equals: email } },
    orderBy: { createdAt: "desc" },
  });
  const link = (mail.payload as { text: string }).text.split("\n").at(-1)!;
  await drainJobs(); // Local fixture capture, not real email delivery.
  await page.goto(link);
  await page.waitForURL(/\/(app|onboarding)/);
  await go("/onboarding");
  await page.getByLabel("Workspace name").fill("Browser research workspace");
  await page.getByLabel("First project").fill("Browser discovery");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL(/\/app\?workspace=/);
  await page.getByLabel("Workspace", { exact: true }).waitFor();
  workspaceId = new URL(page.url()).searchParams.get("workspace")!;
  projectId = (await db.project.findFirstOrThrow({ where: { workspaceId } }))
    .id;
  passed(
    "Browser registration, local email verification, session and onboarding persist",
  );

  await go(href("research/new"));
  await page.getByLabel("Source title").fill("Browser interview");
  await page
    .getByLabel("Transcript, responses, or original notes")
    .fill("I need the full cost before involving my team.");
  await page.getByRole("button", { name: "Save research source" }).click();
  await page.waitForURL(/\/app\/research\/[^?]+/);
  await page.getByLabel("Exact source passage").fill("the full cost");
  await page
    .getByLabel("What does this suggest?")
    .fill("Needs pricing clarity.");
  await page.getByRole("button", { name: "Save observation" }).click();
  await waitText("1 saved observations");
  passed("Browser research capture and exact anchored observation");

  await go(href("builder"));
  await page.getByRole("button", { name: /Start with research/ }).click();
  await waitText("AI is not configured.");
  assert(
    await page
      .getByRole("button", { name: "Propose a cited draft" })
      .isDisabled(),
  );
  await page.getByRole("button", { name: "Continue manually" }).click();
  await page.getByLabel("Persona name").fill("The browser deliberate buyer");
  await page
    .getByLabel(/^What should your team understand\?(?:\s|$)/)
    .fill("Needs pricing clarity before involving the team.");
  await page.getByLabel("Overall classification").selectOption("finding");
  await page.getByRole("button", { name: "Add goal", exact: true }).click();
  await page.getByLabel(/^goal 1(?:\s|$)/).fill("Understand the full cost.");
  await page.getByLabel("Classification for goal 1").selectOption("finding");
  await page.locator("details summary").first().click();
  await page.locator("details").first().getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save persona", exact: true }).click();
  await page.waitForURL(/\/app\/persona\?/);
  personaId = new URL(page.url()).searchParams.get("id")!;
  await page
    .getByRole("button", { name: "Submit revision 1 for review" })
    .click();
  await page
    .getByRole("button", { name: "Approve revision 1", exact: true })
    .click();
  await waitText("Saved revision 1 · approved");
  passed(
    "AI unavailable state preserves manual cited persona authoring and human approval",
  );
  await scan("Approved persona editor desktop");
  await page.locator("main").focus();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: "docs/evidence/persona-desktop.png",
    fullPage: true,
  });

  await go(href("publish"));
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Publish snapshot & create link" })
    .click();
  const shareInput = page.getByLabel("Share link");
  await shareInput.waitFor();
  const shareUrl = await shareInput.inputValue();
  const anonymous = await browser.newContext();
  const shared = await anonymous.newPage();
  await shared.goto(shareUrl);
  await shared
    .getByText("The browser deliberate buyer", { exact: true })
    .waitFor();
  assert(
    !(await shared.locator("body").innerText()).includes(
      "I need the full cost before involving my team.",
    ),
  );
  await page.getByRole("button", { name: "Revoke access" }).click();
  await shared.reload();
  await shared
    .getByText(/expired|revoked/i)
    .first()
    .waitFor();
  await anonymous.close();
  passed(
    "Browser publication omits raw transcript and revocation denies the shared view",
  );

  await go(href("exports"));
  for (const format of ["csv", "pdf"]) {
    await page.getByLabel("File format").selectOption(format);
    const exportSaved = page.waitForResponse(
      (response: { url: () => string; ok: () => boolean }) =>
        response.url().endsWith("/commands") && response.ok(),
    );
    await page.getByRole("button", { name: "Prepare export" }).click();
    await exportSaved;
    await drainJobs();
    await page.reload();
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("link", { name: "Download", exact: true })
      .first()
      .click();
    const download = await downloadPromise;
    assert.equal(await download.failure(), null);
    const data = await readFile((await download.path())!);
    assert(
      format === "pdf"
        ? data.subarray(0, 4).toString() === "%PDF"
        : data.toString().includes("The browser deliberate buyer"),
    );
  }
  passed("Browser private CSV and PDF exports download valid files");

  await go(href("journeys"));
  await page.getByLabel("Journey name").fill("Browser evaluation journey");
  await page
    .getByLabel("Context and questions")
    .fill("Validate pricing clarity.");
  await page.getByRole("button", { name: "Save journey", exact: true }).click();
  await page.waitForURL(/document=/);
  await go(href("briefs"));
  await page.getByLabel("Brief title").fill("Browser pricing brief");
  await page
    .getByLabel("Decision, proposed action, and how you will test it")
    .fill(
      "Test whether total-cost information resolves the observed confusion.",
    );
  await page.getByRole("button", { name: "Save brief", exact: true }).click();
  await page.waitForURL(/document=/);
  passed("Browser journeys and action briefs save to the database");

  await go(href("persona"));
  await page
    .getByLabel(/^What should your team understand\?/)
    .fill("Updated draft with the same permitted evidence.");
  await page.getByRole("button", { name: "Save new revision" }).click();
  await waitText("Saved revision 2 · draft");
  await go(href("history"));
  const oldRevision = page.locator(".card").filter({
    has: page.getByRole("heading", { name: "Revision 1", exact: true }),
  });
  await oldRevision
    .getByRole("button", { name: "Compare with current" })
    .click();
  await page
    .getByRole("heading", { name: "Revision 1 → 2", exact: true })
    .waitFor();
  await oldRevision
    .getByRole("button", { name: "Restore as new draft" })
    .click();
  await page.waitForURL(/\/app\/persona\?/);
  await waitText("Saved revision 3 · draft");
  await page.getByRole("button", { name: "Duplicate persona" }).click();
  await page.waitForURL(
    (url: URL) =>
      url.pathname === "/app/persona" &&
      url.searchParams.get("id") !== personaId,
  );
  await go(href("compare"));
  assert.equal(
    await page.getByRole("link", { name: "Read persona", exact: true }).count(),
    2,
  );
  passed(
    "Browser edit, historical comparison, restore-as-new-draft, duplication and audience comparison",
  );

  await go(href("support"));
  await page.getByLabel(/^Subject(?:\s|$)/).fill("Browser support request");
  await page
    .getByLabel("How can we help?")
    .fill("Please verify our fixture support journey.");
  await page.getByRole("button", { name: "Save support request" }).click();
  await page
    .getByRole("heading", { name: "Browser support request" })
    .waitFor();
  await page.goto(origin + "/admin");
  await page.waitForURL(/\/app/);
  assert(!new URL(page.url()).pathname.startsWith("/admin"));
  passed(
    "Customer support persists and customer role cannot access staff pages",
  );
  await db.user.update({ where: { email }, data: { staffRole: "admin" } });
  await go("/admin/support");
  await page
    .getByLabel("Reply to customer")
    .fill("Verified fixture reply, queued for local capture.");
  await page
    .getByLabel("Recorded reason for this staff action")
    .fill("Browser acceptance verification.");
  await page.getByRole("button", { name: "Save reply & queue email" }).click();
  await waitText("Operation saved and audited.");
  await go("/admin/content");
  await page.getByLabel("Page path").fill("browser-fixture");
  await page
    .getByLabel(/^Page title(?:\s|$)/)
    .fill("Browser editorial fixture");
  await page
    .getByLabel(
      /^Article body \(plain text, paragraphs separated by blank lines\)(?:\s|$)/,
    )
    .fill("A locally verified editorial fixture, not production content.");
  await page
    .getByLabel("Reason for this revision")
    .fill("Browser content acceptance verification.");
  await page.getByRole("button", { name: "Save content revision" }).click();
  await waitText("Operation saved and audited.");
  passed(
    "Authenticated staff support reply and editorial revision are saved and audited",
  );

  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/",
      "/pricing",
      "/login",
      "/signup",
      href(""),
      href("persona"),
      href("research"),
      href("exports"),
      "/admin/support",
    ]) {
      await go(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      checks.push({
        name: `${width}px ${path.split("?")[0]} horizontal layout`,
        status: overflow <= 1 ? "passed" : `failed: ${overflow}px overflow`,
      });
    }
  }
  await page.setViewportSize({ width: 320, height: 800 });
  await go(href("persona"));
  await scan("Persona editor 320px");
  await page.locator("main").focus();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: "docs/evidence/persona-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Toggle workspace navigation" })
    .click();
  await page.getByRole("dialog", { name: "Workspace navigation" }).waitFor();
  await page.keyboard.press("Shift+Tab");
  assert(await page.getByRole("dialog").locator(":focus").count());
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator(":focus").getAttribute("aria-label"),
    "Toggle workspace navigation",
  );
  passed(
    "320px workspace menu keyboard focus containment, Escape and focus restoration",
  );
  await go("/pricing");
  await scan("Pricing 320px");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Product", exact: true })
    .click();
  await page.waitForURL("**/product");
  passed("320px public mobile navigation");

  await page.setViewportSize({ width: 1280, height: 900 });
  await go(href("billing"));
  await waitText("not connected");
  await go(href("research/new"));
  await page.getByRole("button", { name: "Upload a source" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "fixture.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("not permitted"),
  });
  await page.getByRole("button", { name: "Upload privately" }).click();
  await waitText("Choose a PDF, TXT, MD, or CSV research file.");
  passed(
    "Browser displays billing unavailability and rejects an unsupported private upload",
  );

  await go(href("persona"));
  await page.getByLabel(/^Sign out(?:\s|$)/).click();
  await page.waitForURL("**/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel(/^Password(?:\s|$)/).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/app/);
  await go(href("persona"));
  assert.equal(
    await page.getByLabel("Persona name").inputValue(),
    "The browser deliberate buyer",
  );
  passed(
    "Browser saved persona survives sign-out and a new authenticated session",
  );
  assert.deepEqual(runtimeErrors, [], "Browser runtime errors");
  assert(
    checks.every((c) => c.status === "passed"),
    "Mobile overflow failures; see browser evidence",
  );
  assert(
    accessibility.every(
      (a) => (a as { violations: unknown[] }).violations.length === 0,
    ),
    "Accessibility violations; see browser evidence",
  );
} catch (error) {
  console.error(error);
  checks.push({
    name:
      error instanceof Error ? error.message : "Browser verification failed",
    status: "failed",
  });
  await page
    .screenshot({ path: "docs/evidence/browser-failure.png", fullPage: true })
    .catch(() => {});
  process.exitCode = 1;
} finally {
  await mkdir("docs/evidence", { recursive: true });
  await writeFile(
    "docs/evidence/browser-e2e.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        source: "Local Next.js production server",
        engine: database.engine,
        storage: process.env.FILE_STORAGE,
        jobExecution: process.env.JOB_EXECUTION,
        browser: await browser.version(),
        checks,
        accessibility,
        runtimeErrors,
        limitations: [
          "Local email capture only; no real provider delivery, payments, S3, malware scanning or AI calls.",
          "Automated Chromium/axe and keyboard checks do not certify screen-reader usability or hosted recovery.",
        ],
      },
      null,
      2,
    ),
  );
  if (process.exitCode)
    await writeFile(".data/browser-server-failure.log", logs);
  await browser.close();
  child.kill("SIGTERM");
  if (child.exitCode === null) await new Promise((r) => child.once("exit", r));
  await db.$disconnect();
  await database.close();
}
