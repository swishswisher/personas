# Hosted launch status

The selected target is the existing **Vercel + Neon** setup. The approved Peach & Lilac design is preserved. The implementation was merged into `master` with user authorization; source publication does not establish deployed readiness. No GitHub Actions are used.

## Completed in code and verified locally

- Prices: Free, Starter **USD $5/month**, Team **$15/month**, Agency **$39/month**. Successful AI-request allowances are 0/10/60/200. Public and workspace pricing share the plan definitions. Checkout refuses configured Stripe prices with the old amounts or wrong billing terms.
- Google sign-in uses Better Auth with state/PKCE, explicit production CSRF/origin checks, encrypted OAuth tokens, and verified-email linking. The button appears only when Google credentials are configured. Real Google authentication has not occurred.
- Google/email templates and `setup:env` prepare ignored mode-0600 files; stable runtime secrets are generated without being printed or overwriting existing files.
- Encrypted PostgreSQL private objects avoid an additional S3 account for a fresh Vercel/Neon MVP. Existing S3/local adapters are preserved. Uploads are capped at 4 MB to fit Vercel requests.
- Post-response jobs serve active signup/extraction/export workflows without manually starting a process. Durable retries/leases remain authoritative; idle queues still need scheduled polling.
- Real local ClamAV accepted clean research, detected the harmless EICAR fixture, enforced authorization and rejected stale signatures. PDFs remain blocked when a real scanner is unavailable.
- Normal locked installation, normal Prisma generation/build, native migrations, encrypted-file recovery, actual customer/staff browser journeys, tenant boundaries, privacy, publishing and exports were verified. See `VERIFICATION.md`.

## Exact remaining hosted blockers

| Requirement                                | Current state and action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel/Neon operator access                | No connected tool, runtime credential or database binding is available in this session. Saved cloud draft requirements: `VERCEL_TOKEN` for api.vercel.com and `NEON_API_KEY` for console.neon.tech. An authorized operator must enter values securely, review/save settings and publish the environment. This is required before the agent can inspect/reuse existing hosting bindings or complete deployment. Never paste secrets into chat.                                                                       |
| Hosted runtime configuration and migration | With access, verify the Personas project/public origin/protection settings and the existing isolated Neon branch/database. Reuse existing bindings; back up any real data. Bind database URLs and the generated server-only auth/encryption/cron/scanner secrets. Apply the additive `202611030001_private_objects` migration using normal Prisma or `db:migrate:sql` against the direct connection. No managed database was changed in this session. Validate the hosted app and recovery before calling it ready. |
| Hosted scanner and scheduled retries       | A local real scanner is verified, but there is no reachable hosted scanner URL or scheduler. Configure an authenticated HTTPS scanning endpoint with updated ClamAV signatures, and periodic authenticated `/api/jobs` polling or a suitable worker. Post-response execution does not replace idle retry/cleanup scheduling. No paid hosting plan or new external resource was silently purchased.                                                                                                                  |
| Owner Google/email credentials             | Fill `.env.google` and `.env.email` from `config/` after the canonical origin is confirmed. Configure Google Web OAuth origin/callback and Resend verified sender/DNS, then securely apply values to the matching Vercel environment. Actual Google sign-in and email delivery must be verified. Split files are not automatically loaded by Next.js.                                                                                                                                                               |
| Optional paid billing and AI               | Free/manual workflows are verified without them. Charging subscriptions requires actual Stripe sandbox keys/prices/portal/tax/webhook configuration and real payment verification. AI requires a gateway key, explicit supported model, provider spend budget, terms and workspace consent; Google OAuth does not supply AI access. No payment, real email delivery or AI execution has been invented.                                                                                                              |
| Final acceptance                           | Repeat authenticated hosted desktop/mobile/keyboard flows and native/managed recovery with actual bindings. Human screen-reader, other-browser and production-load checks remain unverified. Confirm applicable business, pricing/tax and privacy/retention terms.                                                                                                                                                                                                                                                  |

The implementation reduces extra setup, but **Google and email files are not the only remaining input while operator access and hosted infrastructure are absent**. Once authorized hosting access is available, configure those runtime services rather than asking the owner to invent application secrets manually.

## Existing resource evidence

Historical records identify Neon project `personas-preview` (`wispy-lab-73069602`), branch `build-complete-personas` (`br-odd-thunder-bbtwwbna`), database `personas`; the first two migrations were previously applied. These resources were not re-inspected here because access is absent. Reuse them only after verifying their identity and contents.

Existing preview: https://personas-git-build-complete-perso-d86431-swishswishers-projects.vercel.app . Its earlier READY result is historical. The fresh request received proxy CONNECT 403, and no current hosted success is claimed. The master merge may trigger Vercel independently; its result remains unverified.

## Acceptance checklist

- [x] Preserve design and implement approved lower prices.
- [x] Prepare Google/email files and safe runtime-secret generation.
- [x] Verify normal build, database-backed private files, automatic active jobs, real local scanning, browser journeys and recovery.
- [ ] Connect Vercel/Neon access and configure actual hosted runtime, scanner and periodic jobs.
- [ ] Supply Google/email credentials and verify real authentication/delivery.
- [ ] Enable and verify Stripe/AI only with actual provider configuration.
- [ ] Complete hosted/recovery/business acceptance before taking customers.

Detailed commands and secure configuration steps: `VERCEL_SETUP.md`. Current progress/evidence: `STATUS.md` and `VERIFICATION.md`. The user has authorized publication; no Actions workflow may be created, enabled, dispatched or rerun.
