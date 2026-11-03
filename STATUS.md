# Personas recovery status

## Current result

The recovered service and Peach & Lilac design are implemented and locally verified. It is **not cleared for customer launch**: this environment has no configured hosting/provider credentials, and policy blocks the existing preview and Prisma native-engine host. Recovery validation left the existing production site untouched. The user subsequently authorized pushing the completed branch and merging into the default branch, `master`; connected hosting may deploy that merge. Provider readiness remains unverified.

## Source and ownership

- Branch: `build/complete-personas-peach-lilac`.
- Recovery source: `9f19e6b329496c76754337c0ad151c57d032c84b`.
- Fetched origin; both the branch and draft PR #1 matched the source at the start and final remote recheck on 2026-11-03. No newer remote work was present.
- Initial checkout was clean. Only Personas was changed. No worktrees, pushes, merges, deployments or GitHub Actions runs were used during recovery validation. Subsequent publication is explicitly authorized; GitHub Actions remain prohibited.
- Local progress commits record the source, privacy/tenant fixes, and browser/native verification fixes. Application dependencies and lockfile are unchanged.

## Verified current results

| Check                                  | Result                                                                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strict TypeScript, ESLint, formatting  | Passed                                                                                                                                             |
| Unit/integration tests on PGlite       | 62 passed                                                                                                                                          |
| Same tests on native PostgreSQL 17     | 61 passed; PGlite-format backup test explicitly skipped                                                                                            |
| Next.js production application build   | Passed using the matching generated Prisma client                                                                                                  |
| Native production HTTP journey         | 61 checks passed                                                                                                                                   |
| Real authenticated Chromium acceptance | 43 checks passed; no runtime JavaScript errors                                                                                                     |
| Mobile layouts                         | 28 checks across 320/375/768/1280px, no horizontal document overflow                                                                               |
| axe WCAG A/AA scans                    | Five scans, zero violations                                                                                                                        |
| Native recovery                        | Actual dump/restore scripts, nonempty-target refusal, restored service/tenant/history/share probe and private source/PDF object restoration passed |
| Production dependency audit            | Zero reported known vulnerabilities                                                                                                                |
| Design checks                          | Original Peach & Lilac tokens/contrast/responsiveness/focus/reduced-motion checks passed                                                           |
| Actions guard                          | No workflows found on fetched master or local checkout; no Actions executed; organization rules not claimed verified                               |

Browser verification covers signup/local email verification, onboarding, research/observations, manual cited authoring without AI, approval/publication/revocation, actual exports, editing/history/restore, duplication/comparison, journeys/briefs, customer support, staff replies/editorial revisions, mobile keyboard/navigation, unavailable billing, rejected uploads and session persistence. HTTP checks additionally verify cross-tenant original-file/export denial, real PDF parsing through the bundled worker, scanner-contract quarantine and retry. Provider fixtures never stand in for live delivery, malware scanning, payment or AI success.

## Changes completed

- Scoped restricted-project notifications/outbox mail to authorized recipients.
- Completed privacy erasure across linked documents, observations, revisions, snapshots, notifications and pending mail; blocked revoked export resurrection.
- Coordinated erasure/evidence validation/document writes/review/publication with workspace locks; enforced document expected versions; protected erased/revoked records from stale failure handlers.
- Corrected obstructed desktop workspace forms caused by fixed-sidebar grid placement.
- Fixed skip-link focus, unique label/readonly associations, required-field accessibility and described hints.
- Added scoped overdue-research retention review, parallel-worker/expired-lease regressions and separate API read/write rate buckets.
- Made AI optional in readiness checks and included scanner configuration. Removed historical organization-rule/push-safety claims from the release guard.
- Added repeatable native test, real browser, logical recovery and restored-service probes, plus current evidence and launch instructions.

## Exact remaining blockers and next steps

The single consolidated blocker list, secure variable names and staging-only configuration steps are in `docs/LAUNCH.md`; reproducible commands and limitations are in `docs/VERIFICATION.md`.

1. Apply the saved network draft additions for `binaries.prisma.sh` and the supplied preview hostname; configure authorized Vercel/Neon staging access. No provider bindings or tools are available in this session.
2. Configure preview database/auth URLs/secret, real email, private S3/scanner, Stripe sandbox and hosted worker/monitoring through secure environment settings; verify their real flows. AI remains optional.
3. Verify managed/encrypted offsite and private-object recovery; complete hosted browser/assistive-technology/other-browser/load checks and business/policy decisions.
4. The user has now authorized branch publication and merging into `master`. Verify the resulting hosting deployment and finish secure provider configuration; a Git merge alone does not establish launch readiness.

The normal Prisma CLI is still blocked by its native download host. Matching official Prisma 7.10.1 packages generated the engine-free TypeScript client using bundled WASM outside the checkout; the actual Next.js build passed without disabling TLS/checksums. Native local fixtures applied committed SQL directly. This does not claim native `prisma migrate deploy` or the normal blocked `npm run build` wrapper succeeded on this machine.

Existing preview (historical deployment only): https://personas-git-build-complete-perso-d86431-swishswishers-projects.vercel.app . Fresh access received proxy CONNECT 403; recovery commits are not deployed there.

## Publication authorization

After recovery verification, the user requested pushing all changes and merging into the default branch. Native Git confirmed that `master` is the default and is an ancestor of the completed recovery branch. Neither checkout contains Actions workflows. GitHub API reads for PR/rules/Actions metadata returned Forbidden, so their current API state is not claimed verified. Publication and merge commits carry `[skip ci]` and `skip-checks: true`; no Actions workflows are added or dispatched.

## Current follow-up: launch preparation and affordable pricing

The user approved Free/$5 Starter/$15 Team/$39 Agency monthly pricing and requested Google sign-in/email setup as their remaining input. Work is in progress on `master` after merge `0a6e901`. Prices and lower AI allowances are centralized across public/workspace pages; Stripe checkout now validates actual recurring amount/currency so old price IDs cannot charge the former rates. Google OAuth and conditional sign-in UI are added, with regression checks underway.

Preparing an optional self-contained deployment using PostgreSQL, durable private local volumes, a genuine ClamAV scanner and the worker, while preserving managed-provider adapters. No hosting/provider credentials are present. Public deployment, real Google/email, payment and AI execution cannot be claimed without the corresponding access/credentials. No GitHub Actions are authorized.

### Follow-up progress

User confirmed the existing **Vercel + Neon** target; a separate self-hosted stack is not the primary deployment. Added encrypted private-object storage in PostgreSQL (new additive migration), so the MVP can avoid separate S3 credentials while retaining S3 support. Added Vercel post-response queue wakeups and a 4 MB upload cap compatible with function request limits. Unattended retries still need periodic scheduling; PDF scanning still needs a reachable hosted service.

Current checks: 67 tests passed on PGlite, 66 passed / one PGlite-only backup test skipped on native PostgreSQL, including OAuth state/PKCE/redirect boundaries, billing amount validation, encrypted-object tamper/swap rejection, and migration checksum/rollback checks. Native runs validate migration-lock concurrency; PGlite has one backend and tests repeated runs sequentially. Five **real ClamAV** checks passed, including clean text, harmless EICAR detection, authorization and stale-signature failure. Local scanner uses bundled signatures, not a fabricated clean response.

Saved cloud draft requirements for VERCEL_TOKEN and NEON_API_KEY with api.vercel.com/console.neon.tech destinations. No values or runtime access have been supplied. Credential files generated by setup:env are ignored, mode 0600, preserve existing files and never print secret values. Runtime auth/file-encryption/cron/scanner secrets can be generated without asking the user to invent them.
