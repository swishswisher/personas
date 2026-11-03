# Personas recovery status

## Current result

The recovered service and Peach & Lilac design are implemented and locally verified. It is **not cleared for customer launch**: this environment has no configured hosting/provider credentials, and policy blocks the existing preview and Prisma native-engine host. Local changes have not been pushed or deployed. The existing production site is untouched.

## Source and ownership

- Branch: `build/complete-personas-peach-lilac`.
- Recovery source: `9f19e6b329496c76754337c0ad151c57d032c84b`.
- Fetched origin; both the branch and draft PR #1 matched the source at the start and final remote recheck on 2026-11-03. No newer remote work was present.
- Initial checkout was clean. Only Personas was changed. No worktrees, pushes, merges, deployments or GitHub Actions runs were used.
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
4. User publishes the local commits through the existing draft PR, verifies the configured Preview, and separately decides production promotion.

The normal Prisma CLI is still blocked by its native download host. Matching official Prisma 7.10.1 packages generated the engine-free TypeScript client using bundled WASM outside the checkout; the actual Next.js build passed without disabling TLS/checksums. Native local fixtures applied committed SQL directly. This does not claim native `prisma migrate deploy` or the normal blocked `npm run build` wrapper succeeded on this machine.

Existing preview (historical deployment only): https://personas-git-build-complete-perso-d86431-swishswishers-projects.vercel.app . Fresh access received proxy CONNECT 403; recovery commits are not deployed there.
