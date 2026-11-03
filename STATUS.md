# Personas recovery status

## Source and scope

- Recovery source: `9f19e6b329496c76754337c0ad151c57d032c84b` on `build/complete-personas-peach-lilac`.
- Fetched origin and verified both the remote recovery branch and PR #1 head on 2026-11-03; both match that commit. No newer branch work was present.
- Initial checkout was clean. Work stays in this project and this local branch. Preserve Peach & Lilac, the established stack and existing production. No pushes, merges, deployments or GitHub Actions runs are authorized by this work.

## Current verification

- Recovery documentation and launch records read; historical results are not new verification.
- Locked dependencies installed with `npm ci` on Node 24.19.0.
- Local Chromium/Playwright and an isolated Docker daemon are available. Official PostgreSQL 17 image pulled with verified digest.
- Prisma CLI generation is blocked by current HTTP policy denying `binaries.prisma.sh`; checksums and TLS remain enabled. Investigating generation using the matching Prisma pure-WASM API without a native engine.
- Preview recheck is blocked by HTTP proxy policy (CONNECT 403). Its previous successful deployment is historical evidence only.
- No Vercel, Neon, email, storage/scanner, Stripe or AI credentials are configured in this environment; no connected service tools are available. No secret values inspected.

## Audit and next steps

1. Run current suites and production build, then real authenticated Chromium customer/staff journeys, mobile widths from 320px, keyboard and accessibility automation.
2. Verify native PostgreSQL persistence, isolation, revisions/concurrency, upload/extraction/export privacy, worker/billing retry boundaries, redaction/retention and backup/restore.
3. Fix demonstrated defects with regression coverage; commit progress locally.
4. Update launch evidence and consolidate exact external configuration/recovery blockers. Never substitute local capture or contract fixtures for successful provider delivery, scanning, payments or AI.

## External access

Network draft additions saved for `binaries.prisma.sh` and the supplied Personas Vercel preview hostname. Saving a draft does not apply it. Current instance remains restricted until settings are applied. Hosting credentials and provider setup remain separate requirements.

## Recovery update: privacy and tenant boundaries

- Re-ran recovered baseline: 54/54 tests, TypeScript, lint and direct Next.js production build passed. Normal `npm run build`/`db:generate` remains blocked by the native-engine host; matching official `@prisma/internals` and `@prisma/client-generator-ts` 7.10.1 generated the pure TypeScript client with bundled WASM (`requiresEngines: []`). Isolated verification tooling is outside application dependencies; no checksum/TLS bypass was used.
- Fixed restricted-project review notifications to reach only owners and explicitly authorized project members.
- Privacy redaction now erases linked journey/brief content, uncited observations on deletion, associated notification content and pending mail; increments document versions; and blocks recreation/retry of redacted exports.
- Persona validation, document updates, review/publication and redaction now coordinate with the workspace transaction lock. Document updates require an expected version. Failed jobs cannot overwrite a redacted source or revoked export state.
- Added six regression checks. New run: 60/60 tests passed on PGlite; 59 passed and the PGlite-only backup test was explicitly skipped on native PostgreSQL 17. Native logical backup/restore will be checked separately.
- Native test mode creates and removes random databases on an explicitly selected local `personas_test` server. It never falls back to application/customer database configuration.

## Recovery update: native service and recovery

- All 57 production HTTP/SSR checks passed again using native PostgreSQL 17, including PDF extraction through the bundled worker and a scanner contract fixture. This is not real malware-scanner verification.
- Exercised the actual `backup.sh` and `restore-check.sh` with native `pg_dump`/`pg_restore`: restored into an empty isolated database, refused a second restore into the populated target, verified tenant denial, source/revision/approval/share data and immutable triggers using the restored service modules, and restored source/PDF objects byte-for-byte. These were local fixture copies; encrypted offsite/PITR and managed object-store recovery remain unverified.
- Chromium found and prompted fixes for skip-link target focus and form label associations (including nameless readonly fields and repeated field names). Unique IDs and associated hints preserve the design.
- Research library now identifies overdue records using the configured review interval, with owner/editor-only scoped counts. Retention remains an explicit human review/removal workflow, not silent evidence deletion.
- Browser acceptance is ongoing; failed intermediate runs are not passing evidence.

## Recovery update: actual browser findings

- Corrected the desktop workspace grid: the fixed sidebar did not occupy a grid cell, so main content fell into the sidebar column and real clicks were obstructed. Main content now explicitly occupies column two.
- Chromium has successfully completed registration/onboarding, research/observation capture, cited manual persona authoring with AI unavailable, approval, publication/revocation, actual CSV/PDF downloads, and journey/brief saving. Full browser/mobile/staff run is still in progress.
- Added scoped retention-review and parallel-worker lease regressions. Latest database runs: 62 passed on PGlite; 61 passed / 1 PGlite-format-only recovery test skipped on native PostgreSQL. A render-purity lint finding in the new retention badge is being resolved by returning the review cutoff from the server.

## Recovery update: mobile and final failure states

- Chromium completed edit/history/restore, duplicate/compare, customer support and staff support/content forms. All 28 inspected layouts (seven screens at 320/375/768/1280px) had no horizontal overflow. Five representative desktop/mobile axe scans had no WCAG A/AA violations. Workspace mobile keyboard containment/Escape/focus restoration and public mobile navigation passed.
- The final unsupported-upload check exposed that API reads and mutations shared a rate-limit key with different thresholds. Separated read/write buckets without increasing either allowance; the complete final browser pass is being rerun.
- Production health checks now treat AI as optional and include scanner configuration. The Actions guard no longer claims current organization rules or push safety based on historical observations. All commits remain local.
