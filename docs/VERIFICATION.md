# Verification evidence

Current follow-up verification ran locally on 3 November 2026, after the recovered implementation was merged into master. It targets the selected Vercel/Neon architecture. No GitHub Actions, real payments, real email delivery, real Google authentication or real AI calls were used.

| Check                           | Result                          | Scope                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Locked installation             | Passed                          | `npm ci`, Node 24, unchanged runtime stack with matching pinned Prisma build tooling                                                                                                                                                                                               |
| Normal generation/build         | Passed                          | `npm run db:generate` and **`npm run build`** use the official Prisma 7.10.1 TypeScript/WASM generator; no native engine download or checksum/TLS bypass                                                                                                                           |
| TypeScript, lint and formatting | Passed                          | Application, scripts, tests and documentation                                                                                                                                                                                                                                      |
| PGlite unit/integration suite   | 68 passed                       | Evidence/citations, Google OAuth state/PKCE/redirect boundaries, lower-price validation, storage authentication/export expiry/deduplication, tenancy, revisions, concurrency, billing boundaries, privacy, retention and workers                                                   |
| Native PostgreSQL suite         | 67 passed, 1 explicitly skipped | Same checks on isolated native PostgreSQL 17; only the PGlite-format data-directory recovery test is skipped                                                                                                                                                                       |
| Production HTTP journey         | 63 checks passed                | Native PostgreSQL, encrypted database private files, post-response jobs, local verification capture without manual worker, real local ClamAV for accepted files, PDF extraction, forced scanner-rejection contract/retry, private-file tenant denial and all customer/staff routes |
| Real Chromium acceptance        | 53 checks passed                | Authenticated customer/staff forms, exact evidence/manual personas, approval/sharing/revocation, actual encrypted CSV/PDF downloads, history/restore, compare, briefs/journeys, support/editorial forms, session persistence, unavailable providers and lower public prices        |
| Responsive layout               | 36 checks within browser total  | Nine populated/public/auth screens at 320/375/768/1280px; no horizontal document overflow                                                                                                                                                                                          |
| axe automation                  | 5 scans, 0 violations           | WCAG 2 A/AA and 2.1 AA tags on representative desktop/mobile pages                                                                                                                                                                                                                 |
| Google browser boundary         | Passed within browser total     | Button generates the real maintained provider authorization URL/state. External Google page is intercepted by a clearly labelled test fixture; it does not authenticate a real Google account                                                                                      |
| Real ClamAV boundary            | 5 checks passed                 | Genuine official engine/signatures, clean file, harmless EICAR detection, unauthorized request denial and stale-signature failure                                                                                                                                                  |
| Native encrypted recovery       | 5 checks passed                 | Actual pg_dump/pg_restore scripts, refusal of populated target, original-object deletion, restored encrypted objects with retained key, tenant/history/share/file probe                                                                                                            |
| SQL migration runner            | Passed in both suites           | Real three application migrations, checksums, repeated runs, failure rollback/unfinished-attempt refusal; concurrent advisory-lock behavior verified on native PostgreSQL. PGlite's one backend tests repeated runs sequentially                                                   |
| Local startup                   | Passed                          | `db:local` preserves .env; `dev:local` uses the isolated connection, applies SQL without native engine, starts Next/worker and serves database health/pricing                                                                                                                      |
| Production audit                | Zero known vulnerabilities      | Current registry `npm audit --omit=dev`; not a security certification                                                                                                                                                                                                              |
| Vercel trace inspection         | Passed locally                  | Jobs/auth/mutation traces contain PDF worker, native canvas and export font; approximately 73–74 MB per inspected trace. Actual Vercel deployment is unverified                                                                                                                    |
| Hosted access                   | Blocked                         | No operator/provider runtime credentials; preview request was denied by proxy policy. No hosted readiness is claimed                                                                                                                                                               |

## Repeat local checks

```bash
npm ci
npm run db:generate
npm run typecheck
npm run lint
npm test
npm run build
node --import tsx scripts/http-e2e.ts
node scripts/design-check.mjs
npm audit --omit=dev
```

For native checks use a separate local PostgreSQL 17 server with a disposable administrator database named `personas_test`:

```bash
PERSONAS_NATIVE_TEST_URL='postgresql://personas_test@127.0.0.1:55433/personas_test?sslmode=disable' npm test
PERSONAS_TEST_FILE_STORAGE=database PERSONAS_TEST_JOB_EXECUTION=after \
PERSONAS_NATIVE_TEST_URL='postgresql://personas_test@127.0.0.1:55433/personas_test?sslmode=disable' \
node --import tsx scripts/http-e2e.ts
```

The helper refuses other administrator database names/remote hosts, creates a random isolated database per run, applies committed migrations, and removes only its own database. Test harnesses never fall back to application DATABASE_URL and do not use injected email/payment/AI credentials.

Browser tooling lives outside application dependencies. Install Playwright 1.62.1 and axe-core 4.11.0 in a separate directory, with Chromium available:

```bash
PERSONAS_TEST_GOOGLE=1 PERSONAS_TEST_FILE_STORAGE=database PERSONAS_TEST_JOB_EXECUTION=after \
CHROMIUM_PATH=/usr/bin/chromium \
PERSONAS_PLAYWRIGHT_MODULE=/path/to/tools/node_modules/playwright \
PERSONAS_AXE_MODULE=/path/to/tools/node_modules/axe-core/axe.min.js \
PERSONAS_NATIVE_TEST_URL='postgresql://personas_test@127.0.0.1:55433/personas_test?sslmode=disable' \
node --import tsx scripts/browser-e2e.ts
```

The runner starts its own production server on port 3102, creates/verifies a fictional fixture account through actual forms, uses local email capture, exercises the browser and downloads, writes evidence and closes its own processes/database. It recorded Chromium 154.0.8037.57. Split credential files are not used by these isolated tests.

## Genuine scanner and recovery

The local official `clamav/clamav:stable` image included signature version 28171 and ClamAV 1.5.4. `npm run test:scanner` checks an isolated loopback daemon (default port 53310). The adapter verifies signature freshness and fails closed. Only the offline fixture disables FreshClam while using the verified bundled database; production must keep signature updates enabled and provide an authenticated HTTPS endpoint.

For the full HTTP path, start the adapter locally and supply `PERSONAS_REAL_SCAN_URL`/`PERSONAS_REAL_SCAN_TOKEN`; accepted PDF bytes then pass through real ClamAV. The forced reject/retry case remains explicitly a contract test. It is not substituted for a deployed scanner.

```bash
PERSONAS_TEST_FILE_STORAGE=database \
PERSONAS_NATIVE_TEST_URL='postgresql://personas_test@127.0.0.1:55433/personas_test?sslmode=disable' \
node --import tsx scripts/native-recovery.ts
```

Recovery uses the local Docker socket and the isolated `personas-verification-postgres` container. Encrypted source/export records are included in the restored DB snapshot and read using the retained test key after deletion from the original database. This does not prove managed PITR, encrypted offsite backup operation, key escrow or a production RPO/RTO.

## Evidence and limits

Current JSON records are in `docs/evidence/`: `browser-e2e.json`, `http-e2e.json`, `scanner-real.json`, `native-recovery.json`, `vercel-traces.json`, `launch-dependency-audit.json` and `actions-safety.json`. Screenshots show approved pricing and fictional fixture data. Older dependency/performance/preview records remain historical.

The free/manual service works without Stripe or AI. Real Google login and email delivery require owner credentials. Charging subscriptions and executing AI require their own providers and spend/consent settings; Google OAuth is not an AI key. Automated Chromium/axe checks do not certify human screen-reader use, other-browser behavior or production load. Post-response jobs do not replace scheduled idle retries. Managed database migration, the hosted scanner/scheduler and deployed application/provider flows remain unverified until hosting access is supplied; see `LAUNCH.md` and `VERCEL_SETUP.md`.
