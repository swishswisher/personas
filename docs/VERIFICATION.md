# Verification evidence

Checked in the execution environment on 2 November 2026. All automated checks were run locally; GitHub Actions were not used.

| Check                              | Result                            | Scope                                                                                                             |
| ---------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| TypeScript                         | Passed                            | Strict `tsc --noEmit` across application, scripts and tests                                                       |
| ESLint                             | Passed, zero errors/warnings      | Next.js, TypeScript, React hooks and accessibility-oriented rules                                                 |
| Unit and integration tests         | 54 passed                         | 11 domain/output tests and 43 database/service/auth/recovery tests                                                |
| Next.js production build           | Passed                            | Next.js 16.4.4 with React 19.3.1; server/client bundles and route generation                                      |
| Production-server HTTP/SSR flow    | 56 checks passed                  | Public routes, customer pages, six staff pages and authenticated research-to-publication behavior                 |
| Production dependency audit        | Zero reported vulnerabilities     | `npm audit --omit=dev`; registry findings at the recorded check time, not a security certification                |
| Design token checks                | Passed                            | Body/muted/button/warning/error contrast and input boundaries; responsive/reduced-motion/focus CSS present        |
| Development database recovery      | Passed                            | Exported PostgreSQL WASM data directory, restored into a fresh engine, verified persona and revision data         |
| Managed PostgreSQL migration       | Passed                            | Both committed migrations applied to isolated Neon project; migration names/checksums recorded                    |
| Browser/mobile/screen-reader audit | Pending                           | Shared managed browser preview belongs to another project and was preserved; hosted environment access is blocked |
| Real provider transactions         | Pending credentials/configuration | No live email, S3/scanner, AI generation, payment, or production restore drill was claimed                        |

## Verified behavior

- Server rejection of nonmembers, guessed cross-workspace IDs, restricted projects, viewer writes/raw research, unauthorized staff operations, and cross-origin mutations.
- Exact source passages, UTF-16-to-code-point conversion, fictional-vs-finding distinctions, invalid/missing citations, estimate method requirements, and AI citation verification.
- Database composite evidence keys, project-member membership constraints, revision-bound comments, immutable revisions/snapshots/audits, concurrent save conflict detection, restoration as a new draft, and preserved approval provenance.
- Email-bound invitations, expiry, revocation, single use, restricted project grants, seat limits, last-owner protection, and immediate denial after member removal.
- Owner-only review approval, publication of the exact approved revision, snapshot isolation from later editing, passphrase checks, expiry/revocation, source privacy and private CSV/PDF exports.
- Signed webhook validation, event/job deduplication, ordered atomic entitlement changes, failed-payment/cancellation handling, lapsed read-only/export access, and explicit unavailable checkout.
- Private uploads through actual Next.js HTTP endpoints, background extraction, a failed extraction/retry without duplicate sources, research storage limits, and queued file cleanup.
- Audited privacy redaction, preservation of revision metadata, invalidation of derived shares/exports, and recovery of persisted redacted records from a development backup.
- Better Auth registration, email verification, sign-in, repeated session reads, sign-out, password reset, rejection of reset-token reuse/old passwords, and sign-in with the new password.
- Persisted enquiries, support/admin route authorization, and saved work after signing out and creating a new signed session.

## Repeat the checks

```bash
npm ci
npm run db:generate
npm run typecheck
npm run lint
npm test
npm run test:e2e
node scripts/design-check.mjs
npm audit --omit=dev
```

The integration suite creates an isolated PostgreSQL WASM/PGlite engine and loads both SQL migrations. The HTTP harness starts a built Next.js server and a separate isolated database in the same process environment; it exercises actual cookies, route handlers, Prisma writes, background jobs and responses. No customer database or provider credentials are used by these tests.

Machine-readable evidence is in `docs/evidence/`: HTTP checks, static design checks, local response timings/artifact sizes, dependency versions, and the Actions release guard. Token-level contrast and HTTP checks do not establish rendered mobile behavior, assistive-technology usability, or Core Web Vitals. A production-size native PostgreSQL/object restore and real sandbox provider journeys remain launch checks listed in `LAUNCH.md`.
