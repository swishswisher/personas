import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createScannerServer, clamavCommand } from "../deploy/scanner.mjs";

const token = randomBytes(32).toString("base64url");
const options = {
  token,
  host: process.env.CLAMAV_HOST || "127.0.0.1",
  port: Number(process.env.CLAMAV_PORT || 53310),
};
const server = createScannerServer(options);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const checks = [];
try {
  const version = await clamavCommand("VERSION", undefined, options);
  assert.equal((await fetch(origin + "/health")).status, 200);
  checks.push(
    "Real ClamAV signatures loaded and passed the 72-hour freshness gate",
  );
  assert.equal(
    (await fetch(origin + "/scan", { method: "POST", body: "test" })).status,
    401,
  );
  checks.push("Unauthorized scan requests denied");
  const scan = (body) =>
    fetch(origin + "/scan", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body,
    });
  assert.deepEqual(await (await scan("A clean interview fixture.")).json(), {
    clean: true,
  });
  checks.push("Real engine accepted a clean text fixture");
  // Standard harmless antivirus test string, not malware.
  const eicar =
    "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
  assert.deepEqual(await (await scan(eicar)).json(), { clean: false });
  checks.push("Real engine rejected the standard EICAR antivirus test fixture");
  const stale = createScannerServer({ ...options, maxSignatureAgeHours: 0 });
  await new Promise((resolve) => stale.listen(0, "127.0.0.1", resolve));
  try {
    assert.equal(
      (
        await fetch(`http://127.0.0.1:${stale.address().port}/scan`, {
          method: "POST",
          headers: { Authorization: "Bearer " + token },
          body: "test",
        })
      ).status,
      503,
    );
  } finally {
    await new Promise((resolve) => stale.close(resolve));
  }
  checks.push("Stale signatures fail closed instead of returning clean");
  await writeFile(
    "docs/evidence/scanner-real.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        version,
        checks,
        limitations: [
          "Isolated local official ClamAV image with bundled signatures; no hosted scanner endpoint has been provisioned.",
          "The local fixture disables FreshClam only during this offline check; production must keep signature updates enabled.",
        ],
      },
      null,
      2,
    ),
  );
  checks.forEach((check) => console.log("PASS", check));
} finally {
  await new Promise((resolve) => server.close(resolve));
}
