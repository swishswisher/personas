# Operations and release runbook

## Configuration and integration setup

Use `.env.example` as the inventory. Keep separate database, auth secret, private bucket, and provider credentials for development, preview, and production. `APP_URL` and `BETTER_AUTH_URL` must match the actual canonical origin. Better Auth may infer a preview base URL; application links fall back to the Vercel branch/deployment URL when an explicit application URL is absent.

1. PostgreSQL: provision an isolated database, use TLS with certificate validation, and set a pooled `DATABASE_URL` plus direct `DIRECT_DATABASE_URL` for migration/backup tools. The implementation uses `pg` and Prisma's PostgreSQL driver adapter.
2. Identity: create a strong random `BETTER_AUTH_SECRET`. Configure transactional email before opening registration. Verify sign-up, verification, password reset, session revocation, and invitation email delivery against your sender/domain.
3. Storage: set `FILE_STORAGE=s3`, `S3_BUCKET`, region/endpoint and credentials or workload identity. Enable bucket-level public-access blocking, encryption, access logging, object versioning as appropriate, and lifecycle rules for expired export objects. Never expose the bucket as a public static origin. Local storage is development-only unless explicitly backed by a durable mounted volume and `ALLOW_LOCAL_STORAGE=true`.
4. File scanning: `UPLOAD_SCAN_URL` accepts the file bytes with its MIME type and bearer token, and returns JSON `{ "clean": true }` only after a successful security scan. Failures reject processing. Production PDF extraction is blocked until the scanner is configured. Isolate the scanner and parsing worker with time/memory/concurrency limits.
5. Email: configure `RESEND_API_KEY` and verified `EMAIL_FROM`. The database outbox is authoritative; the provider idempotency key is stable across retries. Development capture is restricted to a localhost application URL.
6. AI: set `AI_GATEWAY_API_KEY` and an explicit current `AI_MODEL` supporting structured output. Enable AI per workspace only after consent/provider terms are reviewed. The AI is optional; missing configuration is an explicit state, not a simulated answer.
7. Billing: create Stripe recurring monthly prices for Starter/Team/Agency, set the three price IDs, API key, and webhook secret. Enable secure customer-portal cancellation, invoice access, and appropriate plan changes. Subscribe the webhook to customer subscription lifecycle events. Checkout computes taxes through Stripe; configure tax registrations/settings for the actual business. Do not use a live secret in a preview.
8. Workers: run `npm run worker` continuously or schedule authenticated `GET /api/jobs` every minute. Set a long random `CRON_SECRET`. No automatic GitHub Actions workflows are supplied. A managed external scheduler/worker is required for timely processing on hosting plans whose cron frequency is limited.

Run `npm run healthcheck` from the configured environment. It reports readiness booleans without printing secrets and returns a failure exit status when a dependency is absent.

## Jobs, retries and incident response

Jobs are leased with a claim token and five-attempt cap. Retries use exponential backoff. A ten-minute stale lease is reclaimable; a stale final attempt becomes a dead letter. Email, extraction, export, billing, and file deletion jobs have stable keys. Completed email payloads are sanitized after seven days. Old rate-limit buckets are purged. Review dead/retry jobs in `/admin/audit`; each manual retry requires a reason and is audited.

Use structured log request/job IDs to correlate errors. Logs intentionally omit request bodies, source text, credentials, passphrases, and share tokens. Configure the host's request-log redaction for `/share/*` token paths. Alert on dead jobs, repeated billing failures, error rates, storage/database saturation, and failed scheduled worker requests.

For a provider outage, keep prior saved data and failed records, repair configuration, and retry the existing job. A checkout redirect never grants entitlements; only a verified event followed by canonical provider reconciliation does. Replaying a billing event is a no-op after successful processing. Out-of-order older events cannot roll back a newer recorded event.

Export downloads repeat requester and project checks. Revoked/expired shares repeat visibility checks for every read. A privacy redaction invalidates derived exports and queues file deletion. Inspect the cleanup jobs after a redaction. Downloaded files and third-party copies cannot be recalled.

## Backup and recovery

Production policy: daily encrypted logical backups to a separate, access-controlled account/location, plus the database provider's point-in-time recovery. Suggested initial RPO is 24 hours for offsite logical recovery and RTO is 4 hours; confirm those targets with an exercised production-size restore. The newly prepared Neon preview has the account's six-hour history retention, which is not a substitute for offsite backups.

Use `scripts/backup.sh` with `DIRECT_DATABASE_URL` and an encrypted-volume `BACKUP_PATH`. It creates a custom-format dump and a restore manifest with restrictive permissions. Store encryption keys separately. Retain at least 30 daily backups initially; apply the final approved business retention policy. Back up private objects with versioning/replication and preserve object keys alongside database records.

Restore only into an empty, isolated database using `scripts/restore-check.sh`, `RESTORE_DATABASE_URL`, `BACKUP_PATH`, and the explicit `RESTORE_CONFIRM=isolated-empty-database`. The script refuses a nonempty target and never uses `--clean`. Verify record counts, tenant permissions, revision/approval relationships, source/file access, a controlled share, and an export before reconnecting an application. Use sandbox email/payment/AI credentials during a drill. Do not send queued customer messages from a recovery drill.

The test suite exercises a PostgreSQL development-engine backup/restore and checks restored persona/revision data. A native PostgreSQL `pg_dump`/`pg_restore` drill against the production topology and private object recovery remains required before launch.

## Migration and rollback

Run migrations before deploying the new application to the isolated target. Both committed migrations were applied to the separate `personas-preview` Neon database; the existing Personas production site was not changed. `_prisma_migrations` contains matching checksums.

For later changes, prefer expand/migrate/contract. Back up first, assess locks/index creation and data volume, and test on a fresh branch or restored copy. Avoid editing an applied migration. The application and data model are new relative to the original static gallery; do not assume an old deployment can operate on the new schema. A rollback should restore the previously tested application deployment while preserving the new database for investigation. Never reset or drop production data as a rollback shortcut.

## Access operations

Staff roles are separate from workspace roles. Grant/revoke them through the audited trusted-operator script described in README. The browser cannot set `staffRole`. Staff account administration includes account metadata, operational events, support and content, and grants no default raw-research access. Customer-authorized membership is required for research assistance.

Workspace owners manage project restrictions and invitations. Invites bind a verified email, expiry, role, and project list. Pending editing invitations reserve seats. Last-owner protection applies to role changes/removal. Check future requests after revocation; do not rely on hidden buttons.

## Zero Actions release

Run all checks in the execution environment. Run `npm run release:check-actions` immediately before every push or PR, inspect current repository/organization rules, and retain changes locally if a trigger cannot be ruled out. No workflows, dispatches, reruns, or Actions-based reviews are authorized. Vercel's own preview build is separate from GitHub Actions; do not promote a preview or merge to `master` until configuration and release verification are complete.
