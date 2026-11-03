# Architecture and security boundaries

One Next.js App Router application uses TypeScript, React, Tailwind, Prisma 7, and PostgreSQL. Public editorial pages render on the server; interactive workspace views call validated same-origin route handlers. Better Auth owns account/password/session operations; tenant authorization remains an application responsibility on every query and mutation.

## Modules

| Module        | Files                                  | Responsibility                                                                                                         |
| ------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Identity      | `server/auth.ts`, `auth-database.ts`   | Maintained authentication; transactional email intent shares the identity transaction through AsyncLocalStorage        |
| Authorization | `server/security.ts`                   | Membership, minimum role, restricted project, viewer research policy, staff role, CSRF and database-backed rate limits |
| Research      | `commands.ts`, `storage.ts`, `jobs.ts` | Validated records, private files, extraction, exact passages and retries                                               |
| Personas      | `personas.ts`, `lib/domain.ts`         | Validated claim classifications, scoped evidence, concurrent edits, immutable revisions and approval                   |
| Collaboration | `team.ts`, `outbox.ts`                 | Email-bound invitations, seat/owner invariants, comments and notifications                                             |
| Publication   | `publishing.ts`, `jobs.ts`             | Approved snapshots, controlled share reads, revocation, private exports                                                |
| AI            | `ai.ts`                                | Selected authorized observations only; structured output, verified citations, quotas, explicit insufficiency           |
| Commerce      | `subscriptions.ts`                     | Provider checkout/portal/invoices, signed durable events, canonical state, idempotent entitlement updates              |
| Operations    | `admin.ts`, `privacy.ts`, `jobs.ts`    | Staff operations, recorded reasons, privacy redaction, retry/dead-letter queue and audit                               |

## Tenant invariants

Core research, observations, personas, revisions, and evidence links carry composite tenant/project keys. Database foreign keys reject cross-tenant evidence links. Project-member triggers require a workspace membership. Comment triggers bind a comment to its own persona revision. A database trigger verifies an observation passage against the original source.

Source offsets are stored as Unicode code-point offsets. Browser UTF-16 selection offsets are validated and converted before persistence. Repeated records use the same participant alias; counts are scoped research coverage, not statistical confidence.

Reads and writes recheck membership. Restricted projects require explicit membership except for owners. Viewer raw-research access is a separate project setting. File downloads, exports, AI retrieval, history, and share retrieval repeat authorization on the server. Responses containing private content are `private, no-store`. Session cookie caching is disabled so database session revocation takes effect immediately.

## Provenance

A persona has a version counter. Saving locks the workspace, compares the expected version, validates the complete content and evidence scope, inserts a new revision, inserts normalized evidence links, and appends an audit event atomically. Review transitions compare the exact version and state. Approval is unique to a revision; snapshots have a database-checked approval scope. Revision/snapshot/approval/evidence and audit mutations are rejected by triggers.

A narrowly scoped exception permits an owner-requested privacy redaction only inside a transaction with a matching audit event and reason. It sanitizes content while retaining revision/approval metadata, revokes shares, invalidates exports, and queues file deletion. Ordinary restore operations never use this exception.

## External boundaries

- Private object storage: server credentials only; file keys never appear in API data or public HTML. Downloads are authorized application endpoints, not public bucket URLs.
- File processing: strict extension/magic/size validation; text is inert data; production PDF handling requires a scanner returning `{clean:true}` before extraction. Parser errors preserve a failed source and retry path.
- AI: no tools or arbitrary document instructions; only selected observations enter the request. Cited IDs must be authorized, quoted text must match, findings require evidence, and estimates require a method. Semantic model correctness still needs human review.
- Billing: redirects do not grant access. The raw webhook signature is checked before a unique event/job is stored. Processing retrieves canonical provider state. Workspace locks and event ordering prevent stale entitlement rollback. Provider idempotency keys protect checkout and email retries.
- Jobs: claimed through `FOR UPDATE SKIP LOCKED`, leased with a lock token, bounded to five attempts, exponentially delayed, and exposed for recorded staff retry. Stale final attempts become dead letters. Auth and notification email intents commit with the originating transaction.

## Limits and scaling

Sources and personas are paginated in batches of 100 with server-side search. Dashboard counts come from database counts, not loaded-page lengths. Selected-persona evidence is fetched explicitly even when outside the recent observation window. Other operational lists are bounded for launch; large-team bulk administration and deeper archival navigation can be extended without changing tenant boundaries. File size is 4 MB (including space for multipart framing under Vercel's request limit) and extracted source text is capped at 250,000 characters. Plan allowances and included usage are defined centrally in `lib/domain.ts`.

Before handling high-volume or sensitive regulated research, validate provider data-processing terms, database/application least-privilege roles, scanner isolation/resource limits, storage quotas/cost controls, and the applicable retention policy.

## Vercel/Neon follow-up

Optional database-backed private objects use AES-256-GCM, unique IVs and object-key authenticated data; the decryption key stays in server-only runtime configuration and must survive recovery. This avoids ephemeral serverless disk storage. Existing S3/local backends are preserved. A new additive migration creates the object table. Post-response queue wakeups improve active workflows while scheduled polling remains required for idle retries. Google OAuth uses the maintained Better Auth provider with state/PKCE, production CSRF/origin checks, encrypted OAuth tokens and verified-email linking constraints.
