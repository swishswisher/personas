import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { testDatabase } from "../scripts/test-database";
import { randomUUID } from "node:crypto";
import type { Actor } from "../src/server/security";
import type { PersonaContent } from "../src/lib/domain";
let database: Awaited<ReturnType<typeof testDatabase>>;
let db: typeof import("../src/server/db").db;
let command: typeof import("../src/server/commands").command;
let access: typeof import("../src/server/security");
let queries: typeof import("../src/server/queries");
let team: typeof import("../src/server/team");
let publishing: typeof import("../src/server/publishing");
let subscriptions: typeof import("../src/server/subscriptions");
let personas: typeof import("../src/server/personas");
let jobs: typeof import("../src/server/jobs");
const actor = (name: string): Actor => ({
  id: randomUUID(),
  name,
  email: name.toLowerCase() + "@integration.example",
  emailVerified: true,
});
const owner = actor("Owner"),
  editor = actor("Editor"),
  viewer = actor("Viewer"),
  outsider = actor("Outsider"),
  invitee = actor("Invitee");
let ws: string,
  ws2: string,
  project: string,
  restricted: string,
  foreign: string,
  sourceId: string,
  observationId: string,
  personaId: string,
  snapshotId: string,
  shareToken: string;
let content: PersonaContent;
beforeAll(async () => {
  for (const key of [
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "STRIPE_SECRET_KEY",
    "AI_GATEWAY_API_KEY",
  ])
    delete process.env[key];
  database = await testDatabase(55666);
  process.env.DATABASE_URL = database.url;
  process.env.BETTER_AUTH_URL = "http://localhost:3100";
  process.env.APP_URL = "http://localhost:3100";
  process.env.BETTER_AUTH_SECRET =
    "integration-only-strong-secret-01234567890123456789";
  process.env.LOCAL_EMAIL_CAPTURE = "true";
  process.env.GOOGLE_CLIENT_ID = "google-fixture.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "google-fixture-not-a-real-secret";
  process.env.FILE_STORAGE = "local";
  process.env.LOCAL_STORAGE_DIR = ".data/integration-files";
  ({ db } = await import("../src/server/db"));
  ({ command } = await import("../src/server/commands"));
  access = await import("../src/server/security");
  queries = await import("../src/server/queries");
  team = await import("../src/server/team");
  publishing = await import("../src/server/publishing");
  subscriptions = await import("../src/server/subscriptions");
  personas = await import("../src/server/personas");
  jobs = await import("../src/server/jobs");
  for (const user of [owner, editor, viewer, outsider, invitee])
    await db.user.create({ data: user });
  const a = await db.workspace.create({
    data: {
      name: "Integration A",
      memberships: {
        create: [owner, editor, viewer].map((u, i) => ({
          userId: u.id,
          role: ["owner", "editor", "viewer"][i],
        })),
      },
      subscription: {
        create: {
          plan: "team",
          status: "active",
          seats: 5,
          periodEnd: new Date(Date.now() + 30 * 86400000),
        },
      },
    },
  });
  ws = a.id;
  ws2 = (
    await db.workspace.create({
      data: {
        name: "Integration B",
        memberships: { create: { userId: outsider.id, role: "owner" } },
        subscription: { create: {} },
      },
    })
  ).id;
  project = (
    await db.project.create({
      data: { workspaceId: ws, name: "Public project" },
    })
  ).id;
  restricted = (
    await db.project.create({
      data: { workspaceId: ws, name: "Restricted project", restricted: true },
    })
  ).id;
  foreign = (
    await db.project.create({
      data: { workspaceId: ws2, name: "Other tenant project" },
    })
  ).id;
});
afterAll(async () => {
  await db?.$disconnect();
  await database?.close();
});
describe("server-enforced tenancy and role boundaries", () => {
  it("denies workspace access to nonmembers", async () => {
    await expect(access.workspaceAccess(outsider, ws)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("denies a guessed cross-workspace project", async () => {
    await expect(
      access.projectAccess(owner, ws, foreign),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("requires explicit restricted project membership for editors", async () => {
    await expect(
      access.projectAccess(editor, ws, restricted),
    ).rejects.toMatchObject({ status: 404 });
    expect((await access.projectAccess(owner, ws, restricted)).project.id).toBe(
      restricted,
    );
  });
  it("does not send private raw research to a viewer", async () => {
    await expect(
      access.projectAccess(viewer, ws, project, "viewer", true),
    ).rejects.toMatchObject({ status: 403 });
    const data = await queries.workspaceData(viewer, ws, project);
    expect(data.sources).toEqual([]);
    expect(data.team).toEqual([]);
  });
  it("denies viewer mutations even through direct service calls", async () => {
    await expect(
      command(viewer, ws, {
        action: "source.create",
        projectId: project,
        title: "Attempt",
        kind: "note",
        text: "No permission",
        tags: [],
        classification: "finding",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("does not grant staff privileges to a workspace owner", async () => {
    await expect(access.staffAccess(owner)).rejects.toMatchObject({
      status: 403,
    });
  });
  it("rejects cross-origin requests", () => {
    expect(() =>
      access.sameOrigin(
        new Request("http://localhost:3100/api/v1", {
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toThrow("must come");
  });
});
describe("research → draft → review → publish → export", () => {
  it("persists real source text and exact anchored observations", async () => {
    const source = (await command(owner, ws, {
      action: "source.create",
      projectId: project,
      title: "Fixture interview",
      kind: "interview",
      text: "I need to understand the full cost before inviting my team.",
      participant: "P01",
      tags: ["pricing"],
      classification: "finding",
    })) as { id: string };
    sourceId = source.id;
    const obs = (await command(editor, ws, {
      action: "observation.create",
      sourceId,
      quote: "understand the full cost",
      start: 10,
      insight: "Needs pricing clarity before team adoption.",
      tags: ["pricing"],
      classification: "finding",
    })) as { id: string };
    observationId = obs.id;
    expect(
      (await db.observation.findUniqueOrThrow({ where: { id: observationId } }))
        .start,
    ).toBe(10);
  });
  it("rejects a fabricated passage", async () => {
    await expect(
      command(editor, ws, {
        action: "observation.create",
        sourceId,
        quote: "Made-up words",
        start: 0,
        insight: "Bad claim",
        tags: [],
        classification: "finding",
      }),
    ).rejects.toMatchObject({ code: "quote_mismatch" });
  });
  it("saves a persona with a supported claim", async () => {
    content = {
      name: "Fixture deliberate buyer",
      subtitle: "Clarity before commitment",
      summary: "An evidence-backed fixture within the interview sample.",
      classification: "finding",
      claims: [
        {
          id: "goal1",
          section: "goal",
          text: "Understand the full cost before involving the team.",
          classification: "finding",
          observationIds: [observationId],
          assumptions: "",
        },
      ],
    };
    const result = await personas.savePersona(editor, ws, {
      projectId: project,
      content,
    });
    personaId = result.id;
    expect(result.version).toBe(1);
    expect(
      await db.evidenceLink.count({ where: { revision: { personaId } } }),
    ).toBe(1);
  });
  it("enforces tenant-consistent evidence foreign keys", async () => {
    const revision = await db.personaRevision.findFirstOrThrow({
      where: { personaId },
    });
    await expect(
      db.evidenceLink.create({
        data: {
          workspaceId: ws2,
          projectId: foreign,
          revisionId: revision.id,
          observationId,
        },
      }),
    ).rejects.toThrow();
  });
  it("rejects silent overwrites from stale versions", async () => {
    await expect(
      personas.savePersona(editor, ws, {
        projectId: project,
        personaId,
        expectedVersion: 0,
        content,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db.personaRevision.count({ where: { personaId } })).toBe(1);
  });
  it("prevents publication before owner review", async () => {
    await expect(
      publishing.publishPersona(owner, ws, {
        personaId,
        version: 1,
        days: 30,
        membersOnly: false,
      }),
    ).rejects.toMatchObject({ code: "not_approved" });
  });
  it("allows editors to submit but only owners to approve", async () => {
    await personas.reviewPersona(editor, ws, personaId, 1, "submit");
    await expect(
      personas.reviewPersona(editor, ws, personaId, 1, "approve"),
    ).rejects.toMatchObject({ status: 403 });
    await personas.reviewPersona(owner, ws, personaId, 1, "approve");
    expect(
      (await db.persona.findUniqueOrThrow({ where: { id: personaId } })).status,
    ).toBe("approved");
  });
  it("creates a fixed snapshot and a hashed controlled share", async () => {
    const result = await publishing.publishPersona(owner, ws, {
      personaId,
      version: 1,
      days: 30,
      membersOnly: false,
      passphrase: "test-private-passphrase",
    });
    snapshotId = result.snapshotId;
    shareToken = result.url.split("/").at(-1)!;
    const grant = await db.shareGrant.findUniqueOrThrow({
      where: { id: result.shareId },
    });
    expect(grant.tokenHash).not.toBe(shareToken);
    await expect(publishing.readShare(shareToken, null)).rejects.toMatchObject({
      code: "passphrase_required",
    });
    const shared = await publishing.readShare(
      shareToken,
      null,
      "test-private-passphrase",
    );
    expect(JSON.stringify(shared)).not.toContain("P01");
    expect((shared.content as unknown as PersonaContent).name).toBe(
      content.name,
    );
  });
  it("keeps approved snapshots unchanged after editing", async () => {
    await personas.savePersona(editor, ws, {
      personaId,
      projectId: project,
      expectedVersion: 1,
      content: { ...content, name: "Revised fixture name" },
    });
    const snapshot = await db.publishedSnapshot.findUniqueOrThrow({
      where: { id: snapshotId },
    });
    expect((snapshot.content as unknown as PersonaContent).name).toBe(
      content.name,
    );
    expect(
      (await db.persona.findUniqueOrThrow({ where: { id: personaId } })).status,
    ).toBe("draft");
  });
  it("prevents mutation of revision and snapshot provenance in SQL", async () => {
    const rev = await db.personaRevision.findFirstOrThrow({
      where: { personaId },
    });
    await expect(
      db.personaRevision.update({
        where: { id: rev.id },
        data: { note: "tamper" },
      }),
    ).rejects.toThrow("Immutable");
    await expect(
      db.publishedSnapshot.update({
        where: { id: snapshotId },
        data: { content: { tamper: true } },
      }),
    ).rejects.toThrow("Immutable");
  });
  it("restores a historical revision as a new draft", async () => {
    const rev = await db.personaRevision.findUniqueOrThrow({
      where: { personaId_number: { personaId, number: 1 } },
    });
    const result = await personas.restorePersona(
      editor,
      ws,
      personaId,
      rev.id,
      2,
    );
    expect(result.version).toBe(3);
    expect(await db.personaRevision.count({ where: { personaId } })).toBe(3);
  });
  it("denies export to viewers and creates private CSV/PDF jobs for editors", async () => {
    await expect(
      command(viewer, ws, {
        action: "export.create",
        snapshotId,
        format: "csv",
      }),
    ).rejects.toMatchObject({ status: 403 });
    await command(editor, ws, {
      action: "export.create",
      snapshotId,
      format: "csv",
    });
    await command(editor, ws, {
      action: "export.create",
      snapshotId,
      format: "pdf",
    });
    const duplicates = await Promise.all([
      command(editor, ws, {
        action: "export.create",
        snapshotId,
        format: "csv",
      }),
      command(editor, ws, {
        action: "export.create",
        snapshotId,
        format: "csv",
      }),
    ]);
    expect(duplicates[0]).toEqual(duplicates[1]);
    expect(await db.exportJob.count({ where: { snapshotId } })).toBe(2);
    await jobs.runJobs(30);
    const exports = await db.exportJob.findMany({ where: { snapshotId } });
    expect(exports.map((e) => e.status)).toEqual(["ready", "ready"]);
    const { getFile } = await import("../src/server/storage");
    const csv = await getFile(
      exports.find((e) => e.format === "csv")!.fileKey!,
    );
    expect(csv.toString()).toContain('"1","finding"');
    const pdf = await getFile(
      exports.find((e) => e.format === "pdf")!.fileKey!,
    );
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
  it("revokes every subsequent share retrieval", async () => {
    const grant = await db.shareGrant.findUniqueOrThrow({
      where: { tokenHash: access.hashToken(shareToken) },
    });
    await publishing.revokeShare(owner, ws, grant.id);
    await expect(
      publishing.readShare(shareToken, null, "test-private-passphrase"),
    ).rejects.toMatchObject({ status: 410 });
  });
  it("cannot delete evidence supporting immutable history", async () => {
    await expect(
      command(owner, ws, { action: "source.delete", sourceId }),
    ).rejects.toMatchObject({ code: "retained_evidence" });
  });
  it("persists journeys, briefs and revision-bound comments", async () => {
    await command(editor, ws, {
      action: "document.save",
      projectId: project,
      kind: "journey",
      title: "Fixture journey",
      content: {
        body: "Proposal to test",
        personaIds: [personaId],
        observationIds: [observationId],
        stages: [
          {
            name: "Evaluate",
            goal: "Understand price",
            friction: "Unclear cost",
            opportunity: "Test total-cost explanation",
            observationIds: [observationId],
          },
        ],
      },
    });
    await command(editor, ws, {
      action: "comment.add",
      personaId,
      version: 3,
      text: "Check the sample context.",
    });
    expect(await db.projectDocument.count({ where: { workspaceId: ws } })).toBe(
      1,
    );
    expect(await db.comment.count({ where: { personaId } })).toBe(1);
  });
});
describe("invitation identity, revocation, seats and membership", () => {
  let invitation: { id: string; url: string };
  it("creates email-bound invitations and rejects a different identity", async () => {
    invitation = await team.createInvitation(owner, ws, {
      email: invitee.email,
      role: "editor",
      projectIds: [restricted],
    });
    await expect(
      team.acceptInvitation(outsider, invitation.url.split("=").at(-1)!),
    ).rejects.toMatchObject({ code: "invite_identity" });
  });
  it("accepts only once and narrows restricted project access", async () => {
    const token = invitation.url.split("=").at(-1)!;
    await team.acceptInvitation(invitee, token);
    await expect(team.acceptInvitation(invitee, token)).rejects.toMatchObject({
      status: 410,
    });
    expect(
      (await access.projectAccess(invitee, ws, restricted)).project.id,
    ).toBe(restricted);
  });
  it("immediately denies a removed member on their next request", async () => {
    const m = await db.membership.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId: ws, userId: invitee.id } },
    });
    await team.changeMember(owner, ws, m.id, "remove");
    await expect(access.workspaceAccess(invitee, ws)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("protects the last owner", async () => {
    const m = await db.membership.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId: ws, userId: owner.id } },
    });
    await expect(
      team.changeMember(owner, ws, m.id, "viewer"),
    ).rejects.toMatchObject({ code: "last_owner" });
  });
  it("rejects expired and revoked invitations", async () => {
    for (const status of ["expired", "revoked"]) {
      const result = await team.createInvitation(owner, ws, {
        email: invitee.email,
        role: "viewer",
        projectIds: [],
      });
      await db.invitation.update({
        where: { id: result.id },
        data:
          status === "expired"
            ? { expiresAt: new Date(0) }
            : { revokedAt: new Date() },
      });
      await expect(
        team.acceptInvitation(invitee, result.url.split("=").at(-1)!),
      ).rejects.toMatchObject({ status: 410 });
    }
  });
  it("enforces free plan editing seats", async () => {
    await expect(
      team.createInvitation(outsider, ws2, {
        email: invitee.email,
        role: "editor",
        projectIds: [],
      }),
    ).rejects.toMatchObject({ code: "seat_limit" });
  });
});
describe("billing retries and ordering", () => {
  const state = () => ({
    id: "sub_fixture",
    customer: "cus_fixture",
    workspaceId: ws2,
    plan: "team" as const,
    status: "active",
    periodEnd: Math.floor(Date.now() / 1000) + 86400,
    cancelAtEnd: false,
  });
  it("applies a verified event once and deduplicates replay", async () => {
    await db.billingEvent.create({
      data: { id: "evt_1", type: "customer.subscription.updated", payload: {} },
    });
    expect(
      await subscriptions.applyBillingState("evt_1", 100, state()),
    ).toMatchObject({ processed: true });
    expect(
      await subscriptions.applyBillingState("evt_1", 100, state()),
    ).toMatchObject({ duplicate: true });
    expect(
      await db.auditEvent.count({ where: { targetId: "sub_fixture" } }),
    ).toBe(1);
  });
  it("ignores delayed older state and preserves entitlements", async () => {
    await db.billingEvent.create({
      data: {
        id: "evt_old",
        type: "customer.subscription.updated",
        payload: {},
      },
    });
    expect(
      await subscriptions.applyBillingState("evt_old", 99, {
        ...state(),
        status: "canceled",
      }),
    ).toMatchObject({ stale: true });
    expect(
      (await db.subscription.findUniqueOrThrow({ where: { workspaceId: ws2 } }))
        .status,
    ).toBe("active");
  });
  it("failed payments and cancellation remove paid entitlements", async () => {
    await db.billingEvent.create({
      data: {
        id: "evt_failed",
        type: "customer.subscription.updated",
        payload: {},
      },
    });
    await subscriptions.applyBillingState("evt_failed", 101, {
      ...state(),
      status: "past_due",
    });
    expect(
      subscriptions.effectivePlan(
        await db.subscription.findUnique({ where: { workspaceId: ws2 } }),
      ).name,
    ).toBe("Free");
    await db.billingEvent.create({
      data: {
        id: "evt_cancel",
        type: "customer.subscription.deleted",
        payload: {},
      },
    });
    await subscriptions.applyBillingState("evt_cancel", 102, {
      ...state(),
      status: "canceled",
      cancelAtEnd: true,
    });
    expect(
      (await db.subscription.findUniqueOrThrow({ where: { workspaceId: ws2 } }))
        .cancelAtEnd,
    ).toBe(true);
  });
  it("does not pretend checkout succeeded without provider configuration", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    await expect(
      subscriptions.checkout(owner, ws, "team"),
    ).rejects.toMatchObject({ code: "billing_unavailable" });
  });
});
describe("authentication persistence and recovery", () => {
  it("starts Google OAuth with state/PKCE, safe redirects and no fabricated account", async () => {
    const { auth } = await import("../src/server/auth");
    const count = await db.user.count();
    const response = await auth.handler(
      new Request("http://localhost:3100/api/auth/sign-in/social", {
        method: "POST",
        headers: {
          origin: "http://localhost:3100",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "google",
          callbackURL: "/app",
          disableRedirect: true,
        }),
      }),
    );
    expect(response.status).toBe(200);
    const result = await response.json();
    const url = new URL(result.url);
    expect(url.hostname).toBe("accounts.google.com");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3100/api/auth/callback/google",
    );
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")?.split(" ").sort()).toEqual([
      "email",
      "openid",
      "profile",
    ]);
    const unsafe = await auth.handler(
      new Request("http://localhost:3100/api/auth/sign-in/social", {
        method: "POST",
        headers: {
          origin: "http://localhost:3100",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "google",
          callbackURL: "https://evil.example",
          disableRedirect: true,
        }),
      }),
    );
    expect(unsafe.status).toBeGreaterThanOrEqual(400);
    expect(await db.user.count()).toBe(count);
  });
  it("registers, verifies, signs in, reads a new session and signs out", async () => {
    const { auth } = await import("../src/server/auth");
    const origin = "http://localhost:3100";
    const email = "auth-fixture@integration.example",
      password = "a-long-fixture-password-2026";
    const request = (path: string, body?: unknown, cookie?: string) =>
      new Request(origin + "/api/auth/" + path, {
        method: body ? "POST" : "GET",
        headers: {
          origin,
          "Content-Type": "application/json",
          ...(cookie ? { cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    const signup = await auth.handler(
      request("sign-up/email", {
        name: "Auth fixture",
        email,
        password,
        callbackURL: "/app",
      }),
    );
    expect(signup.status).toBe(200);
    expect(
      (await db.user.findUniqueOrThrow({ where: { email } })).emailVerified,
    ).toBe(false);
    const mail = await db.job.findFirstOrThrow({
      where: { kind: "email", payload: { path: ["to"], equals: email } },
      orderBy: { createdAt: "desc" },
    });
    const url = (mail.payload as { text: string }).text.split("\n").at(-1)!;
    const verify = await auth.handler(new Request(url));
    expect([200, 302]).toContain(verify.status);
    const signin = await auth.handler(
      request("sign-in/email", { email, password }),
    );
    expect(signin.status).toBe(200);
    const cookie = signin.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    expect(cookie).toContain("session_token");
    const first = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });
    const second = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });
    expect(first?.user.email).toBe(email);
    expect(second?.session.id).toBe(first?.session.id);
    const signout = await auth.handler(request("sign-out", {}, cookie));
    expect(signout.status).toBe(200);
    expect(
      await auth.api.getSession({ headers: new Headers({ cookie }) }),
    ).toBeNull();
    const reset = await auth.handler(
      request("request-password-reset", {
        email,
        redirectTo: origin + "/reset",
      }),
    );
    expect(reset.status).toBe(200);
    const recovery = await db.job.findFirstOrThrow({
      where: {
        kind: "email",
        AND: [
          { payload: { path: ["to"], equals: email } },
          {
            payload: {
              path: ["subject"],
              equals: "Reset your Personas password",
            },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    const recoveryUrl = (recovery.payload as { text: string }).text
      .split("\n")
      .at(-1)!;
    // Better Auth's emailed URL exchanges the reset token for the application redirect.
    const recoveryResponse = await auth.handler(new Request(recoveryUrl));
    const location = recoveryResponse.headers.get("location") || recoveryUrl;
    const resetToken = new URL(location, origin).searchParams.get("token");
    expect(resetToken).toBeTruthy();
    const newPassword = "a-new-long-fixture-password-2026";
    const changed = await auth.handler(
      request("reset-password", { token: resetToken, newPassword }),
    );
    expect(changed.status).toBe(200);
    const replay = await auth.handler(
      request("reset-password", {
        token: resetToken,
        newPassword: "another-long-password-2026",
      }),
    );
    expect(replay.status).toBeGreaterThanOrEqual(400);
    const oldPassword = await auth.handler(
      request("sign-in/email", { email, password }),
    );
    expect(oldPassword.status).toBeGreaterThanOrEqual(400);
    const recovered = await auth.handler(
      request("sign-in/email", { email, password: newPassword }),
    );
    expect(recovered.status).toBe(200);
  });
});

describe("additional integrity and recovery paths", () => {
  it("keeps Unicode passages exact across JavaScript and PostgreSQL offsets", async () => {
    const text = "🙂 I need clear costs before I invite my team.";
    const s = (await command(owner, ws, {
      action: "source.create",
      projectId: project,
      title: "Unicode fixture",
      kind: "note",
      text,
      participant: "P02",
      tags: [],
      classification: "finding",
    })) as { id: string };
    const quote = "clear costs",
      start = text.indexOf(quote);
    const o = (await command(editor, ws, {
      action: "observation.create",
      sourceId: s.id,
      quote,
      start,
      insight: "Needs cost clarity.",
      tags: [],
      classification: "finding",
    })) as { id: string };
    const observation = await db.observation.findUniqueOrThrow({
      where: { id: o.id },
    });
    expect(observation.start).toBe(Array.from(text.slice(0, start)).length);
  });
  it("rejects cross-workspace project membership at the database boundary", async () => {
    await expect(
      db.projectMember.create({
        data: { projectId: project, userId: outsider.id },
      }),
    ).rejects.toThrow("must belong");
  });
  it("allows a single winner for simultaneous saves of the same revision", async () => {
    const results = await Promise.allSettled([
      personas.savePersona(editor, ws, {
        personaId,
        projectId: project,
        expectedVersion: 3,
        content,
      }),
      personas.savePersona(editor, ws, {
        personaId,
        projectId: project,
        expectedVersion: 3,
        content,
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(
      (await db.persona.findUniqueOrThrow({ where: { id: personaId } }))
        .version,
    ).toBe(4);
  });
  it("restricts lapsed subscriptions to read and export permissions", async () => {
    await expect(
      access.projectAccess(outsider, ws2, foreign, "editor"),
    ).rejects.toMatchObject({ code: "workspace_readonly" });
    expect(
      (
        await access.projectAccess(
          outsider,
          ws2,
          foreign,
          "editor",
          false,
          true,
        )
      ).project.id,
    ).toBe(foreign);
  });
  it("verifies signed webhook ingestion and replay-safe job creation", async () => {
    const { default: Stripe } = await import("stripe");
    process.env.STRIPE_SECRET_KEY = "sk_test_fixture_only";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_fixture_only";
    const payload = JSON.stringify({
      id: "evt_signed_fixture",
      type: "customer.subscription.updated",
      created: Math.floor(Date.now() / 1000),
      data: { object: { id: "sub_fixture" } },
    });
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });
    await expect(
      subscriptions.receiveBillingEvent(payload, "invalid"),
    ).rejects.toThrow();
    await subscriptions.receiveBillingEvent(payload, signature);
    await subscriptions.receiveBillingEvent(payload, signature);
    expect(
      await db.billingEvent.count({ where: { id: "evt_signed_fixture" } }),
    ).toBe(1);
    expect(
      await db.job.count({ where: { key: "billing:evt_signed_fixture" } }),
    ).toBe(1);
    delete process.env.STRIPE_SECRET_KEY;
  });
  it("redacts cited research through an audited exception and revokes derived outputs", async () => {
    const { redactSource } = await import("../src/server/privacy");
    await expect(
      redactSource(editor, ws, sourceId, "Requested privacy erasure."),
    ).rejects.toMatchObject({ status: 403 });
    const result = await redactSource(
      owner,
      ws,
      sourceId,
      "Requested fixture privacy erasure.",
    );
    expect(result.affectedPersonas).toBe(1);
    expect(result.affectedDocuments).toBe(1);
    const document = await db.projectDocument.findFirstOrThrow({
      where: { workspaceId: ws },
    });
    expect(document.title).toBe("Redacted research document");
    expect(document.version).toBe(2);
    expect(document.content).toMatchObject({
      stages: [],
      personaIds: [],
      observationIds: [],
    });
    const source = await db.researchSource.findUniqueOrThrow({
      where: { id: sourceId },
    });
    expect(source.text).toBe("");
    expect(source.participant).toBeNull();
    const revisions = await db.personaRevision.findMany({
      where: { personaId },
    });
    expect(revisions).toHaveLength(4);
    expect(
      revisions.every(
        (r) =>
          (r.content as unknown as PersonaContent).name === "Redacted persona",
      ),
    ).toBe(true);
    expect(
      (await db.exportJob.findMany({ where: { snapshotId } })).every(
        (e) => e.status === "revoked",
      ),
    ).toBe(true);
    expect(
      await db.auditEvent.count({
        where: { action: "privacy.redacted", targetId: sourceId },
      }),
    ).toBe(1);
  });
  it("does not resurrect a revoked export through retry or a fresh export request", async () => {
    const exp = await db.exportJob.findFirstOrThrow({ where: { snapshotId } });
    await expect(
      command(editor, ws, { action: "export.retry", exportId: exp.id }),
    ).rejects.toMatchObject({ code: "export_revoked" });
    await expect(
      command(owner, ws, {
        action: "export.create",
        snapshotId,
        format: "pdf",
      }),
    ).rejects.toMatchObject({ code: "export_revoked" });
    expect(
      (await db.exportJob.findUniqueOrThrow({ where: { id: exp.id } })).status,
    ).toBe("revoked");
  });
  it("rejects a stale document that tries to reintroduce erased citations", async () => {
    const document = await db.projectDocument.findFirstOrThrow({
      where: { workspaceId: ws },
    });
    await expect(
      command(editor, ws, {
        action: "document.save",
        documentId: document.id,
        expectedVersion: 1,
        projectId: project,
        kind: "journey",
        title: "Stale journey",
        content: {
          body: "Old sensitive text",
          stages: [],
          personaIds: [],
          observationIds: [observationId],
        },
      }),
    ).rejects.toMatchObject({ code: "evidence_scope" });
  });
  it("requires an expected version for document updates and permits one concurrent winner", async () => {
    const document = await db.projectDocument.findFirstOrThrow({
      where: { workspaceId: ws },
    });
    const input = {
      action: "document.save",
      documentId: document.id,
      projectId: project,
      kind: "journey",
      title: "Permitted replacement",
      content: {
        body: "New permitted hypothesis",
        stages: [],
        personaIds: [],
        observationIds: [],
      },
    };
    await expect(command(editor, ws, input)).rejects.toMatchObject({
      code: "conflict",
    });
    const results = await Promise.allSettled([
      command(editor, ws, { ...input, expectedVersion: document.version }),
      command(editor, ws, { ...input, expectedVersion: document.version }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it.skipIf(!!process.env.PERSONAS_NATIVE_TEST_URL)(
    "preserves persisted data when a PostgreSQL development backup is restored",
    async () => {
      const backup = await database.pg!.dumpDataDir();
      const restored = await PGlite.create({ loadDataDir: backup });
      try {
        const result = await restored.query<{ name: string }>(
          'SELECT name FROM "Persona" WHERE id=$1',
          [personaId],
        );
        expect(result.rows[0].name).toBe("Redacted persona");
        const revisions = await restored.query<{ count: number }>(
          'SELECT count(*)::int AS count FROM "PersonaRevision" WHERE "personaId"=$1',
          [personaId],
        );
        expect(revisions.rows[0].count).toBe(4);
      } finally {
        await restored.close();
      }
    },
  );
});

describe("upload and queue recovery", () => {
  it("persists authenticated encrypted private objects, detects tampering and deletes them", async () => {
    const previousStorage = process.env.FILE_STORAGE;
    const previousKey = process.env.FILE_ENCRYPTION_KEY;
    const { randomBytes } = await import("node:crypto");
    const { putFile, getFile, deleteFile } =
      await import("../src/server/storage");
    process.env.FILE_STORAGE = "database";
    process.env.FILE_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    const key = "research/encrypted-fixture";
    try {
      const body = Buffer.from("A confidential database-backed private file.");
      await putFile(key, body, "text/plain");
      expect(await getFile(key)).toEqual(body);
      const object = await db.privateObject.findUniqueOrThrow({
        where: { key },
      });
      expect(Buffer.from(object.ciphertext).includes(body)).toBe(false);
      const altered = Buffer.from(object.ciphertext);
      altered[0] ^= 1;
      await db.privateObject.update({
        where: { key },
        data: { ciphertext: altered },
      });
      await expect(getFile(key)).rejects.toThrow("authenticate");
      await putFile(key, body, "text/plain");
      await db.privateObject.create({
        data: { ...object, key: "research/swapped-fixture" },
      });
      await expect(getFile("research/swapped-fixture")).rejects.toThrow(
        "authenticate",
      );
      await deleteFile(key);
      await deleteFile("research/swapped-fixture");
      expect(await db.privateObject.count()).toBe(0);
      const expiredKey = "exports/encrypted-expiry-fixture";
      await putFile(expiredKey, body, "text/plain");
      const exp = await db.exportJob.create({
        data: {
          snapshotId,
          requestedBy: editor.id,
          format: "csv",
          fileKey: expiredKey,
          status: "ready",
          expiresAt: new Date(0),
        },
      });
      await jobs.runJobs(40);
      const cleaned = await db.exportJob.findUniqueOrThrow({
        where: { id: exp.id },
      });
      expect(cleaned.status).toBe("expired");
      expect(cleaned.fileKey).toBeNull();
      await expect(getFile(expiredKey)).rejects.toMatchObject({ status: 404 });
      await expect(
        command(editor, ws, { action: "export.retry", exportId: exp.id }),
      ).rejects.toMatchObject({ code: "export_expired" });
    } finally {
      process.env.FILE_STORAGE = previousStorage;
      if (previousKey === undefined) delete process.env.FILE_ENCRYPTION_KEY;
      else process.env.FILE_ENCRYPTION_KEY = previousKey;
    }
  });
  it("claims a queued job once across parallel workers and dead-letters an expired final lease", async () => {
    const job = await db.job.create({
      data: {
        key: "parallel-worker-fixture",
        kind: "delete_file",
        payload: { fileKey: "research/absent-fixture" },
      },
    });
    await Promise.all([jobs.runJobs(40), jobs.runJobs(40)]);
    const complete = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(complete.status).toBe("complete");
    expect(complete.attempts).toBe(1);
    const stale = await db.job.create({
      data: {
        key: "stale-final-fixture",
        kind: "extract",
        payload: {},
        status: "processing",
        attempts: 5,
        lockedAt: new Date(Date.now() - 11 * 60000),
        lockToken: "expired-fixture",
      },
    });
    await jobs.runJobs(1);
    expect(
      (await db.job.findUniqueOrThrow({ where: { id: stale.id } })).status,
    ).toBe("dead");
  });
  it("flags only permitted overdue sources for the configured retention review interval", async () => {
    const source = await db.researchSource.create({
      data: {
        workspaceId: ws,
        projectId: project,
        title: "Retention fixture",
        kind: "note",
        text: "Review consent and relevance",
        tags: [],
        createdAt: new Date(Date.now() - 400 * 86400000),
      },
    });
    const ownerData = await queries.workspaceData(owner, ws, project);
    expect(ownerData.counts.retentionDue).toBe(1);
    expect(
      (await queries.workspaceData(viewer, ws, project)).counts.retentionDue,
    ).toBe(0);
    await command(owner, ws, { action: "source.delete", sourceId: source.id });
    expect(
      (await queries.workspaceData(owner, ws, project)).counts.retentionDue,
    ).toBe(0);
  });
  it("does not leak restricted project names in notifications or queued emails", async () => {
    const p = await personas.savePersona(owner, ws, {
      projectId: restricted,
      content: {
        name: "Restricted audience secret",
        subtitle: "",
        summary: "Private hypothesis",
        classification: "hypothesis",
        claims: [],
      },
    });
    await personas.reviewPersona(owner, ws, p.id, p.version, "submit");
    const notifications = await db.notification.findMany({
      where: {
        workspaceId: ws,
        text: { contains: "Restricted audience secret" },
      },
    });
    expect(notifications.some((n) => n.userId === owner.id)).toBe(true);
    expect(
      notifications.some(
        (n) => n.userId === viewer.id || n.userId === editor.id,
      ),
    ).toBe(false);
    for (const user of [viewer, editor])
      expect(
        await db.job.count({
          where: {
            kind: "email",
            payload: { path: ["to"], equals: user.email },
            key: { in: notifications.map((n) => "notification:" + n.id) },
          },
        }),
      ).toBe(0);
  });
  it("clears uncited observation content and linked briefs when a source is removed", async () => {
    const source = (await command(owner, ws, {
      action: "source.create",
      projectId: project,
      title: "Uncited private record",
      kind: "note",
      text: "Private uncited passage",
      tags: [],
      classification: "finding",
    })) as { id: string };
    const observation = (await command(owner, ws, {
      action: "observation.create",
      sourceId: source.id,
      quote: "Private uncited passage",
      start: 0,
      insight: "Private insight",
      tags: [],
      classification: "finding",
    })) as { id: string };
    const doc = (await command(owner, ws, {
      action: "document.save",
      projectId: project,
      kind: "brief",
      title: "Private brief",
      content: {
        body: "Private insight",
        stages: [],
        observationIds: [observation.id],
        personaIds: [],
      },
    })) as { id: string };
    await command(owner, ws, { action: "source.delete", sourceId: source.id });
    expect(
      (
        await db.observation.findUniqueOrThrow({
          where: { id: observation.id },
        })
      ).quote,
    ).toBe("[redacted]");
    expect(
      (await db.projectDocument.findUniqueOrThrow({ where: { id: doc.id } }))
        .title,
    ).toBe("Redacted research document");
  });
  it("serializes a simultaneous save and privacy redaction without retaining erased content", async () => {
    const source = (await command(owner, ws, {
      action: "source.create",
      projectId: project,
      title: "Race record",
      kind: "note",
      text: "Erase this exact evidence",
      tags: [],
      classification: "finding",
    })) as { id: string };
    const obs = (await command(owner, ws, {
      action: "observation.create",
      sourceId: source.id,
      quote: "Erase this exact evidence",
      start: 0,
      insight: "Erase this insight",
      tags: [],
      classification: "finding",
    })) as { id: string };
    const c: PersonaContent = {
      name: "Erase this persona",
      subtitle: "",
      summary: "Erase this summary",
      classification: "finding",
      claims: [
        {
          id: "one",
          section: "goal",
          text: "Erase this insight",
          classification: "finding",
          observationIds: [obs.id],
          assumptions: "",
        },
      ],
    };
    const p = await personas.savePersona(owner, ws, {
      projectId: project,
      content: c,
    });
    const { redactSource } = await import("../src/server/privacy");
    const results = await Promise.allSettled([
      personas.savePersona(owner, ws, {
        projectId: project,
        personaId: p.id,
        expectedVersion: p.version,
        content: c,
      }),
      redactSource(owner, ws, source.id, "Concurrent privacy erasure request."),
    ]);
    expect(results[1].status).toBe("fulfilled");
    const revisions = await db.personaRevision.findMany({
      where: { personaId: p.id },
    });
    expect(
      revisions.every(
        (r) =>
          (r.content as unknown as PersonaContent).name === "Redacted persona",
      ),
    ).toBe(true);
    await expect(
      personas.savePersona(owner, ws, { projectId: project, content: c }),
    ).rejects.toMatchObject({ code: "evidence_scope" });
  });
  it("preserves a failed source and retries extraction without duplicating it", async () => {
    const { putFile } = await import("../src/server/storage");
    const key = "research/integration/retry-fixture";
    await putFile(key, Buffer.from([0xff, 0xff]), "text/plain");
    const source = await db.researchSource.create({
      data: {
        workspaceId: ws,
        projectId: project,
        title: "Extraction retry fixture",
        kind: "upload",
        fileKey: key,
        mime: "text/plain",
        tags: [],
        status: "processing",
        classification: "finding",
      },
    });
    await db.job.create({
      data: {
        key: "extract:" + source.id,
        kind: "extract",
        payload: { sourceId: source.id },
      },
    });
    await jobs.runJobs(40);
    expect(
      (await db.researchSource.findUniqueOrThrow({ where: { id: source.id } }))
        .status,
    ).toBe("failed");
    await putFile(
      key,
      Buffer.from("A recoverable interview passage."),
      "text/plain",
    );
    await command(editor, ws, { action: "source.retry", sourceId: source.id });
    await jobs.runJobs(40);
    expect(
      (await db.researchSource.findUniqueOrThrow({ where: { id: source.id } }))
        .text,
    ).toBe("A recoverable interview passage.");
    expect(await db.researchSource.count({ where: { fileKey: key } })).toBe(1);
  });
  it("rejects an expired share even when its passphrase is correct", async () => {
    const grant = await db.shareGrant.findUniqueOrThrow({
      where: { tokenHash: access.hashToken(shareToken) },
    });
    await db.shareGrant.update({
      where: { id: grant.id },
      data: { revokedAt: null, expiresAt: new Date(0) },
    });
    await expect(
      publishing.readShare(shareToken, null, "test-private-passphrase"),
    ).rejects.toMatchObject({ status: 410 });
  });
  it("enforces research storage allowance inside the saving transaction", async () => {
    const quota = await db.researchSource.create({
      data: {
        workspaceId: ws,
        projectId: project,
        title: "Quota reservation fixture",
        kind: "note",
        text: "",
        tags: [],
        bytes: 1024 * 1024 * 1024,
      },
    });
    const old = await db.subscription.findUniqueOrThrow({
      where: { workspaceId: ws },
    });
    await db.subscription.update({
      where: { id: old.id },
      data: { plan: "starter" },
    });
    await expect(
      command(editor, ws, {
        action: "source.create",
        projectId: project,
        title: "Over quota",
        kind: "note",
        text: "Another source",
        tags: [],
        classification: "finding",
      }),
    ).rejects.toMatchObject({ code: "storage_limit" });
    await db.researchSource.update({
      where: { id: quota.id },
      data: { deletedAt: new Date() },
    });
    await db.subscription.update({
      where: { id: old.id },
      data: { plan: "team" },
    });
  });
});
