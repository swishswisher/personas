# Vercel + Neon setup

This is the selected hosting target. The app builds and passes local native-database/browser checks. Hosted access has not been supplied, so this guide is preparation, not a claim that the deployment or its providers are configured.

## Access needed to finish the hosted work

Connect the Personas Vercel project and existing isolated `personas-preview` Neon project. This session has no connected service tools or credentials. Secure cloud draft requirements for `VERCEL_TOKEN` (api.vercel.com) and `NEON_API_KEY` (console.neon.tech) are saved; enter values through environment settings, review/save, then publish the environment. Never paste tokens into chat. These operator credentials must not become application environment variables or enter the repository.

Inspect existing project bindings first and reuse them. Confirm the canonical public application origin, deployment protection, project/team identity, the exact Neon branch/database, existing records and backup status. Do not substitute another project or assume the historical preview is current. Verify an isolated Preview before changing production bindings.

## The Google and email files

Generate the ignored configuration files after the real application origin is known:

```bash
npm run setup:env -- --origin https://YOUR-REAL-APPLICATION-HOST
```

This creates `.env.runtime`, `.env.google`, `.env.email` and `.env.integrations` with mode 0600. It never overwrites existing files or prints secret values. The generated runtime file contains unique auth, storage-encryption, cron and scanner secrets; its database/scanner destinations must be bound to the real services. It is not a replacement for provisioning those services.

The two credential files for the owner to fill are:

| File          | Values                                     | Provider-side setup                                                                                                                                                                                                                               |
| ------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env.google` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth **Web application**; exact authorized origin and `https://YOUR-REAL-APPLICATION-HOST/api/auth/callback/google`; configure consent and publish the OAuth application as appropriate. Use separate clients for Preview and Production. |
| `.env.email`  | `RESEND_API_KEY`, `EMAIL_FROM`             | Verify the sending domain/DNS in Resend. Keep `LOCAL_EMAIL_CAPTURE=false` in hosting.                                                                                                                                                             |

Checked-in templates are `config/google.env.example` and `config/email.env.example`. Actual files are ignored. **Next.js does not automatically load these split files**: securely import/apply their values in the corresponding Vercel environment. No credential uses a `NEXT_PUBLIC_` name. Google remains hidden until both credentials are configured; verified email/password accounts remain usable independently.

The remaining runtime bindings can be configured by the operator with hosting access. Creating only Google/email files does not make an unconfigured public host work.

## Database and durable private files

1. Reuse the exact isolated Neon target documented in `LAUNCH.md`. Inspect its records and take the appropriate backup first.
2. Set pooled `DATABASE_URL` and direct `DIRECT_DATABASE_URL` in the matching Vercel environment. Use TLS/certificate validation. Keep Preview and Production isolated.
3. Run `npm run db:migrate` with normal Prisma native-engine access, or `npm run db:migrate:sql` against the **direct** connection. The latter applies the same committed SQL, records Prisma-compatible migration names/checksums, holds a session advisory lock, refuses changed/unknown/unfinished migrations, and rolls failed SQL back. It has been tested on native PostgreSQL. Do not use a transaction-pooled URL for migration locks.
4. There are now three migrations, including `202611030001_private_objects`. Do not edit the previously applied migrations. No managed database was migrated during this session.
5. For a fresh Vercel/Neon MVP set `FILE_STORAGE=database` and the generated `FILE_ENCRYPTION_KEY`. This stores private file/export bytes in PostgreSQL using AES-256-GCM with authenticated object identifiers. It avoids an additional S3 account and ephemeral Vercel filesystem storage. The normal source/download/export authorization gates still apply.
6. Preserve this encryption key across redeployments and backups; changing or losing it prevents decryption. Back it up separately and securely. Database backups include encrypted objects; restoring them with the retained key was verified locally. Configure and exercise managed PITR/offsite recovery separately.
7. If an existing deployment already stores objects in S3 or on a durable volume, retain that backend until its objects have been explicitly migrated and verified. Do not flip the global storage mode and strand existing files.

Uploads are capped at 4 MB, leaving multipart overhead below Vercel's function request limit. Extracted text remains capped at 250,000 characters. Plan storage allowances are application ceilings, not a promise that an unconfigured Neon plan includes that capacity; monitor and budget the actual database plan.

## File scanning and jobs

PDFs remain blocked without a real scanner. `deploy/scanner.mjs` is an authenticated HTTP adapter for a genuine ClamAV daemon. The local real-engine checks accepted clean text, rejected the harmless EICAR fixture, rejected unauthorized requests, and failed closed on stale signatures. This adapter is not a fake `{clean:true}` endpoint.

Host the adapter/daemon on appropriate private worker infrastructure, keep signatures updated, isolate resource limits, expose only an HTTPS adapter endpoint, and never expose raw ClamAV TCP publicly. Bind its URL/token as `UPLOAD_SCAN_URL`/`UPLOAD_SCAN_TOKEN`. The optional `deploy/scanner.Dockerfile` packages the adapter; the daemon and its signature updates are separate infrastructure. The local verification fixture disabled FreshClam only while using the image's verified bundled signatures; do not do that in production. The adapter rejects signatures older than 72 hours.

`JOB_EXECUTION=after` (also the Vercel default) wakes durable jobs after successful account/mutation/webhook responses, so an active signup or export does not require a manually started process. The native HTTP/browser runs verified this behavior. Work is bounded and uses the existing lease/retry queue; it is not guaranteed to finish before a serverless timeout.

Configure **periodic authenticated polling** of `GET /api/jobs` with `Authorization: Bearer <CRON_SECRET>`, or an appropriate persistent worker. This remains necessary for unattended retries, cleanup and idle queues. Choose a Vercel plan/scheduler supporting the required frequency; no paid plan was silently purchased and no GitHub Actions scheduler is permitted. Inspect dead/retry jobs and configure alerts. The worker expires private export bytes through durable deletion jobs, and repeated unexpired exports of the same requester/snapshot/format reuse the existing artifact.

## Optional payments and AI

Manual personas and the free workspace do not require Stripe or AI. To accept paid subscriptions, create actual recurring **monthly USD $5 / $15 / $39** prices and configure the Stripe fields in `.env.integrations` using sandbox values first. Checkout retrieves the configured price and refuses mismatched old amounts, currency, interval or metered usage. Existing subscriptions are not silently repriced; handle their migration explicitly with billing access. Set up portal/tax/webhook settings and verify real sandbox flows.

AI questions and cited persona proposals are implemented but require an actual gateway key and an explicit current structured-output-capable model (`AI_GATEWAY_API_KEY`, `AI_MODEL`). Google OAuth credentials do **not** provide AI access. The monthly successful-request allowances are Free 0, Starter 10, Team 60, Agency 200. Configure a provider spend budget as well, review terms/regions, enable workspace consent and evaluate actual outputs. Local citation validation and an unavailable-provider state do not establish real AI execution.

## Release acceptance

Run `npm ci`, `npm run db:generate`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. The generator uses matching official Prisma 7.10.1 TypeScript/WASM packages and needs no native download. No TLS or checksum verification is disabled.

After deployment, verify `/api/health`, real Google sign-in, actual email verification/recovery/invitations, saved data after a new session, cross-tenant denial, real private upload/scanning/extraction, approval/share revocation, exports, retries and managed recovery. Repeat authenticated mobile/keyboard/browser checks on the hosted origin. Verify paid/AI flows only if enabling their providers. Keep logs free of credentials, source text, and share-token paths.
