# Personas

A complete Next.js audience research and persona workspace, implemented from the approved Peach & Lilac design. Research, observations, saved personas, revision history, team permissions, approval, publishing, exports, subscriptions, support, and platform operations use server-side persistence and authorization.

The original static gallery is preserved in Git history. No separate backend or GitHub Actions workflows are used.

## Run locally

Requires Node.js 24 LTS and npm. Node.js 22.12+ is also supported by the dependencies.

```bash
npm ci
npm run db:generate
```

Choose one development database:

1. **Ordinary PostgreSQL 17+:** copy `.env.example` to `.env`, set `DATABASE_URL`, `BETTER_AUTH_SECRET` (at least 32 random bytes), `APP_URL`, and `BETTER_AUTH_URL`. Run `npm run db:migrate`, then `npm run dev` and `npm run worker` in separate terminals.
2. **Isolated development engine:** run `npm run db:local` once to prepare ignored `.env.local-db`, stop it, then run `npm run dev:local`. This starts a persistent PostgreSQL WASM/PGlite engine, applies migrations, starts Next.js on `http://127.0.0.1:3100`, and runs jobs. This is a development convenience; production uses PostgreSQL over TCP.

Use `http://localhost:3100` consistently if your auth URLs use `localhost`; cookies and CSRF checks require a matching origin. `scripts/dev.ts` binds to loopback. You may set your development URL explicitly in `.env.local-db`.

Development emails are captured privately under `.data/mail` only when `LOCAL_EMAIL_CAPTURE=true` and the configured application URL is localhost/127.0.0.1. Open the verification link from the captured message to complete registration. There is no built-in account or hardcoded password. Production registration fails clearly until transactional email is configured.

## What works

- Public product, solutions, methodology, fictional examples, resources, pricing, about, privacy/terms, and persisted enquiry forms.
- Better Auth registration, email verification, password recovery, persistent sessions, sign-out, and a private onboarding flow.
- Workspaces, scoped/restricted projects, owner/editor/viewer roles, email-bound expiring single-use invitations, seat checks, and last-owner protection.
- Private PDF/TXT/MD/CSV uploads, asynchronous extraction, interview/survey/note records, exact Unicode source passages, observations, participant aliases, tags, search, and paginated libraries.
- Saved manual or evidence-assisted personas, explicit finding/estimate/hypothesis/fictional labels, evidence validation, duplication, archival, comments, optimistic concurrency, immutable revisions, comparison, and restore-as-new-draft.
- Editable audience journeys and action briefs, linked to personas and observations. Evidence gaps distinguish record counts from participant references.
- Optional AI questions and persona proposals from selected authorized observations. Citation IDs and quotes are verified; provider failure does not fabricate a result. Owners control AI consent; monthly usage is enforced.
- Revision-bound review/approval, immutable published snapshots, hashed sharing tokens, expiration, optional passphrases, verified-email or project-member restrictions, revocation, and private PDF/CSV export jobs.
- Subscription checkout, customer portal, invoice history, included editing seats, signed durable webhook ingestion, idempotency, canonical-state reconciliation, retry queues, and lapsed-subscription read-only/export access.
- Persisted support threads, transactional notifications/outbox, staff support replies, content revisions, enquiries, subscription inspection, retries, and append-only audit records.
- An explicit owner privacy-redaction flow: removes the source and affected persona content, preserves provenance metadata, revokes shares, invalidates exports, and queues private file deletion. Downloaded copies cannot be recalled.

## Validation

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm audit --omit=dev
```

The tests use the same Prisma client, migrations, service modules, and Next.js production server. Test databases are isolated in-memory PostgreSQL WASM engines and are never customer databases. `test:e2e` performs HTTP/SSR checks across public, customer, and staff routes and the complete authenticated research-to-publication journey. It does **not** claim browser interaction or assistive-technology certification.

See [verification evidence](docs/VERIFICATION.md), [architecture](docs/ARCHITECTURE.md), [operations](docs/OPERATIONS.md), and [launch dependencies](docs/LAUNCH.md).

## Production configuration

Set the environment variables listed in `.env.example`. Use PostgreSQL, a durable private S3-compatible bucket, a file-security scanner for PDF uploads, Resend transactional email with a verified sender, and a scheduled worker or authenticated job endpoint. Stripe prices must match the approved plans; the billing portal must allow cancellation and appropriate plan changes. Configure an explicit current structured-output-capable AI Gateway model if offering AI.

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run build
npm start
```

Run `npm run worker` continuously on a worker host, or request `GET /api/jobs` at least once a minute using `Authorization: Bearer <CRON_SECRET>`. Vercel Hobby cron frequency is insufficient for prompt outbox delivery; use an appropriate external scheduler/worker. No GitHub Actions are needed or supplied.

Do not run migrations against the old production database without a backup and reviewed connection target. The prepared Neon project is separate and empty of customer records. Never place secrets in source control, browser bundles, logs, or issue/PR text.

## Demonstration data and staff access

Create and verify your own account first. To create an isolated, labelled demonstration workspace:

```bash
DEMO_OWNER_EMAIL=your-verified-email npm run db:seed
```

All demonstration research is fictional. Existing workspaces are not replaced or populated. Demo workspaces cannot check out.

Grant staff access from a trusted operator terminal with database credentials:

```bash
OPERATOR_ID=your-operator-identity node --import tsx scripts/grant-staff.ts your-verified-email admin "Initial platform operator provisioning"
```

Staff authorization is separate from workspace roles and does not automatically expose research.

## Releasing without GitHub Actions

Before every push or PR, run `npm run release:check-actions`. It fetches the current base branch and refuses to continue if workflow files exist on the base or implementation checkout. Inspect repository/organization rules too. If any push/PR could consume Actions minutes, keep the tested commits locally. Do not add or rerun workflows.

The implementation branch is `build/complete-personas-peach-lilac`. Keep `master` and the existing production deployment intact until configuration, browser verification, and launch dependencies have been resolved.
