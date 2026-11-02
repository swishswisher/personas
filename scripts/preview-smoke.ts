import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:3102";
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
  {
    stdio: "ignore",
    env: {
      ...process.env,
      DATABASE_URL: "",
      APP_URL: origin,
      BETTER_AUTH_URL: origin,
      BETTER_AUTH_SECRET: "preview-smoke-only-secret-01234567890123456789",
      LOCAL_EMAIL_CAPTURE: "false",
    },
  },
);
try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(origin)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  assert(ready);
  for (const path of ["/product", "/pricing", "/contact"]) {
    const start = performance.now();
    const response = await fetch(origin + path);
    const html = await response.text();
    const elapsed = performance.now() - start;
    assert.equal(response.status, 200);
    assert(html.includes("<main"));
    assert(
      elapsed < 3000,
      `Public ${path} stalled without database configuration: ${elapsed}ms`,
    );
    console.log("PASS unconfigured preview", path, Math.round(elapsed) + "ms");
  }
  const signup = await fetch(origin + "/api/auth/sign-up/email", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "No delivery fixture",
      email: "unconfigured@fixture.example",
      password: "a-long-fixture-password-2026",
    }),
  });
  assert.equal(signup.status, 503);
  console.log(
    "PASS registration clearly unavailable without email configuration",
  );
} finally {
  child.kill("SIGTERM");
  await new Promise((r) => child.once("exit", r));
}
