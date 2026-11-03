# Personas status

## Current objective and source

The user requested a ready Vercel/Neon service with owner-supplied Google/email credentials and approved much lower prices. The original recovered implementation was merged into master at `0a6e901`. This follow-up is on `master`; feature commit `cee2305` records the main changes, followed by verification/setup refinements. Publication is authorized. No GitHub Actions are permitted or used.

## Implemented and verified locally

- Approved monthly USD prices: Free / Starter $5 / Team $15 / Agency $39. AI successful-request allowances: 0/10/60/200. Shared website/workspace definitions; real Stripe price amount/interval/currency validation before checkout.
- Google OAuth sign-in/button with maintained state/PKCE checks, explicit CSRF/origin validation, encrypted OAuth tokens and verified-email account-linking constraints. Real provider login awaits credentials.
- Ignored Google/email/integration templates and safe env-file preparation. Auth, file-encryption, cron and scanner secrets are generated privately, mode 0600, without overwriting files or printing values.
- Additive encrypted-private-object migration and PostgreSQL storage option for a fresh Vercel/Neon MVP; preserves S3/local backends. Vercel-compatible 4 MB upload limit. Expired export bytes are queued for deletion; duplicate unexpired snapshot exports are reused.
- Post-response job wakeups for accounts, mutations and webhooks; durable queue/retry/lease behavior retained with bounded processing. Periodic idle retries still need hosting configuration.
- Genuine ClamAV HTTP adapter and tests, including harmless EICAR detection and stale-signature refusal. Only the local scanner is running/verified; no hosted endpoint is claimed.
- Official engine-free Prisma generation makes the **normal npm run build** work. Direct SQL migration runner validates checksums/unfinished/unknown state, uses a native session advisory lock, records compatible metadata and rolls failures back.
- Local startup preserves .env, restricts its DB to loopback, applies migrations and starts the worker/application without native engine downloads.

## Current evidence

| Check                                                                | Result                                                                               |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Frozen npm ci, normal generation/build, TypeScript, lint, formatting | Passed                                                                               |
| PGlite suites                                                        | 68 passed                                                                            |
| Native PostgreSQL 17 suites                                          | 67 passed, 1 explicitly skipped PGlite-format backup test                            |
| Native production HTTP                                               | 63 passed, encrypted DB files + automatic jobs + real local ClamAV on accepted files |
| Real Chromium customer/staff journeys                                | 53 passed, no runtime errors                                                         |
| Responsive layout                                                    | 36 checks across 320/375/768/1280px, no horizontal document overflow                 |
| axe accessibility                                                    | Five scans, zero violations                                                          |
| Genuine ClamAV                                                       | Five checks passed                                                                   |
| Native encrypted recovery                                            | Five checks passed                                                                   |
| Production dependency audit                                          | Zero known vulnerabilities                                                           |
| Local startup and health/pricing                                     | Passed                                                                               |
| Vercel trace contents                                                | PDF worker, canvas and font included; approximately 73–74 MB                         |

Google's external authorization page is a labelled boundary fixture in the browser test, not real authentication. Email uses local capture. Payments and AI were not executed. Migration concurrency is verified with independent native PostgreSQL sessions; PGlite tests repeated runs sequentially.

## External blocker: public readiness is not established

No Vercel/Neon operator credential, database binding, Google/email credential, Stripe key or AI key is present in this runtime. No current hosted success, managed migration, real email delivery, Google login, payment, AI call or hosted recovery is claimed. The existing preview request was blocked by HTTP proxy policy.

Cloud draft requirements were saved for VERCEL_TOKEN and NEON_API_KEY, including api.vercel.com and console.neon.tech. An authorized operator must enter values securely, review/save and publish the environment. The draft does not apply itself. Runtime access remained absent at the final presence check.

With access, verify/reuse the exact existing Vercel/Neon resources, apply the additive migration, bind generated runtime secrets, configure a hosted scanner and periodic queue polling, and verify the real deployed service. Owner Google/email files then finish those authentication credentials. Paid billing and AI each need their own provider configuration if enabled. It would be inaccurate to say that only Google/email files remain while hosting access and infrastructure are missing.

## Handoff

- `docs/VERCEL_SETUP.md`: exact secure file/provider/runtime/migration steps.
- `docs/LAUNCH.md`: one consolidated remaining blocker list and acceptance checklist.
- `docs/VERIFICATION.md`: actual commands, evidence and limits.
- `.env.google` / `.env.email` are prepared from checked-in config templates using `npm run setup:env`; never commit their values.

The task stays within Personas. Existing user files and credential values were preserved. Any source push remains separate from Vercel deployment/hosted verification; no Actions workflow may be created or dispatched.
