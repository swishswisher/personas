# Verification evidence

Recovery verification on 3 November 2026 started from `9f19e6b329496c76754337c0ad151c57d032c84b`. The recovery branch and PR #1 remote heads both matched that source; local commits contain the fixes. All commands ran locally. No GitHub Actions, pushes, merges or deployments were performed.

| Check                          | Current result                        | Scope                                                                                                                                                                                                |
| ------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strict TypeScript and ESLint   | Passed                                | Application, service modules, scripts and tests                                                                                                                                                      |
| PGlite unit/integration suite  | 62 passed                             | Evidence/citations, permissions, revisions, concurrency, billing event replay, privacy, retention review, worker retries/leases and account recovery                                                 |
| Native PostgreSQL 17 suite     | 61 passed, 1 explicitly skipped       | Same suite against random isolated native databases; only the PGlite data-directory-format backup test is skipped                                                                                    |
| Next.js production build       | Passed                                | Actual Next.js 16.4.4 server/client build with generated Prisma 7.10.1 client                                                                                                                        |
| Native production HTTP journey | 61 checks passed                      | Actual accounts/cookies, public/customer/staff routes, research-to-publication, private downloads and tenant denial, PDF extraction, scanner-contract rejection and retry                            |
| Actual Chromium acceptance     | 43 checks passed                      | Authenticated customer and staff forms, revision comparison/restore, duplication/comparison, publishing/revocation, actual CSV/PDF downloads, outages and invalid upload, signed-session persistence |
| Responsive layouts             | 28 checks passed within browser total | Seven populated screens at 320, 375, 768 and 1280 pixels; no horizontal document overflow                                                                                                            |
| Accessibility automation       | 5 axe scans, 0 violations             | WCAG 2 A/AA and 2.1 AA tags on public/pricing/persona desktop and pricing/persona 320px                                                                                                              |
| Keyboard behavior              | Passed within browser total           | Skip-link focus, mobile workspace focus containment/Escape/restoration, public mobile navigation                                                                                                     |
| Native logical recovery        | Passed                                | Actual repository `pg_dump`/`pg_restore` scripts, empty-target enforcement, restored service/tenant/immutable-history probe, local private source/export object restoration                          |
| Production dependency audit    | 0 known vulnerabilities               | Current `npm audit --omit=dev`; not a security certification                                                                                                                                         |
| Peach & Lilac design checks    | Passed                                | Original tokens preserved; contrast, breakpoints, focus and reduced-motion checks                                                                                                                    |
| Hosted preview recheck         | Blocked                               | Proxy CONNECT 403 for supplied Vercel hostname; no fresh hosted/deployment success is claimed                                                                                                        |

## Fixes demonstrated during recovery

- Restricted-project review notifications/outbox messages now reach only owners and explicitly permitted project members.
- Privacy erasure sanitizes referenced journeys/briefs, observations, persona history, linked notifications and queued mail; invalidates shares/exports and queues object deletion. Uncited source deletion also removes associated observation/document content.
- Redaction, persona evidence validation, document updates, review and publication coordinate through a workspace transaction lock. Missing/stale document versions and simultaneous saves are rejected. Revoked exports cannot be resurrected through retry/new-export requests or failure handlers.
- The actual browser found the fixed-sidebar grid placement bug that obstructed forms. Explicit main-column placement fixes it without changing the design.
- Skip-link targets receive focus; form IDs are unique, readonly fields have associated labels, and hints are programmatically described.
- API read traffic no longer consumes the mutation rate-limit bucket. Neither rate allowance was increased.
- The configured retention review interval now identifies scoped overdue sources. Retention is a human review/removal process; it does not silently erase cited history.
- Optional AI no longer makes an otherwise configured manual service fail its operational readiness check. Scanner configuration is included.

## Repeating verification

Use Node 24. With normal network access:

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

For native checks, start a separate loopback-only PostgreSQL 17 server with a disposable administrator database named `personas_test`, then set `PERSONAS_NATIVE_TEST_URL` for the test commands. The helper refuses other hosts/administrator database names, creates a random database for every run, applies the committed SQL migrations, and drops only that random database after disconnecting. It never falls back to an application `DATABASE_URL`.

```bash
PERSONAS_NATIVE_TEST_URL='postgresql://personas_test@127.0.0.1:55433/personas_test?sslmode=disable' npm test
PERSONAS_NATIVE_TEST_URL='postgresql://personas_test@127.0.0.1:55433/personas_test?sslmode=disable' node --import tsx scripts/http-e2e.ts
PERSONAS_NATIVE_TEST_URL='postgresql://personas_test@127.0.0.1:55433/personas_test?sslmode=disable' node --import tsx scripts/native-recovery.ts
```

The recovery runner additionally uses the local Docker socket and the isolated `personas-verification-postgres` container (override `PERSONAS_TEST_CONTAINER` only for another Personas fixture container). It runs the actual backup/restore scripts inside that container; no database/client tools need installing on the application host.

Browser verification uses external test tooling rather than modifying application dependencies. Install Playwright 1.62.1 and axe-core 4.11.0 in a separate tooling directory, install Chromium if necessary, and supply their locations:

```bash
CHROMIUM_PATH=/usr/bin/chromium \
PERSONAS_PLAYWRIGHT_MODULE=/path/to/tools/node_modules/playwright \
PERSONAS_AXE_MODULE=/path/to/tools/node_modules/axe-core/axe.min.js \
PERSONAS_NATIVE_TEST_URL='postgresql://personas_test@127.0.0.1:55433/personas_test?sslmode=disable' \
node --import tsx scripts/browser-e2e.ts
```

The browser runner starts its own production server on port 3102 and isolated database, creates and verifies a fixture account through real browser forms, inspects its development-only email intent, exercises the application and downloads, writes evidence, then closes its own processes/database. It uses no customer account or data. Browser evidence records Chromium 154.0.8037.57. Private development capture is not real email delivery.

## Current machine's Prisma limitation

The HTTP policy denies `binaries.prisma.sh`, so the normal Prisma CLI attempts to download a native schema engine and fails with 403. TLS and artifact checksum verification were never disabled. The matching official `@prisma/internals` and `@prisma/client-generator-ts` 7.10.1 packages were installed outside the checkout. Their `getGenerators` API with an in-process `PrismaClientTsGenerator` generated this schema's pure TypeScript client using bundled WASM (`requiresEngines: []`). The subsequent build was `node node_modules/next/dist/bin/next build`. This verifies the generated client/application, not successful execution of the blocked `npm run build` wrapper or native `prisma migrate deploy` on this machine. Local test databases applied the committed SQL directly. The normal build/migration commands still require the network prerequisite.

## Evidence and limits

Machine-readable current evidence: `docs/evidence/browser-e2e.json`, `http-e2e.json`, `native-recovery.json`, `recovery-dependency-audit.json`, `preview-recheck.json`, and `actions-safety.json`. Desktop/mobile screenshots use fictional acceptance-fixture content.

Local filesystem storage, email capture and scanner contracts do not prove real Resend delivery, S3 privacy/lifecycle behavior, malware scanning, Stripe sandbox/live transactions or AI-provider output. Native local recovery does not prove encrypted offsite/PITR/object-provider recovery. Automated Chromium/axe checks do not certify screen-reader usability, Safari/Firefox behavior, performance under production load or hosted integrations. Those exact launch prerequisites remain in `LAUNCH.md`.
