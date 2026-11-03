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
