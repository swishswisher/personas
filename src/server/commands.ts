import { reserveSourceCapacity } from "./quotas";
import { z } from "zod";
import { db } from "./db";
import { projectAccess, workspaceAccess, type Actor } from "./security";
import { ensure, personaContent } from "@/lib/domain";
import { savePersona, restorePersona, reviewPersona } from "./personas";
import { createInvitation, changeMember } from "./team";
import { publishPersona, revokeShare } from "./publishing";
import { checkout, billingPortal, effectivePlan } from "./subscriptions";
import { assist } from "./ai";
const text = (max = 4000) => z.string().trim().min(1).max(max),
  id = z.string().min(1).max(200),
  version = z.number().int().min(1);
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("project.create"),
    name: text(100),
    description: z.string().max(1000),
    restricted: z.boolean(),
    viewerResearch: z.boolean(),
  }),
  z.object({
    action: z.literal("project.update"),
    projectId: id,
    name: text(100),
    description: z.string().max(1000),
    restricted: z.boolean(),
    viewerResearch: z.boolean(),
    memberIds: z.array(id).max(200),
  }),
  z.object({
    action: z.literal("source.create"),
    projectId: id,
    title: text(200),
    kind: z.enum(["interview", "survey", "note"]),
    text: text(250000),
    participant: z.string().max(100).optional(),
    tags: z.array(text(40)).max(20),
    classification: z.enum(["finding", "hypothesis", "fictional"]),
  }),
  z.object({ action: z.literal("source.retry"), sourceId: id }),
  z.object({
    action: z.literal("source.redact"),
    sourceId: id,
    reason: text(500),
  }),
  z.object({ action: z.literal("source.delete"), sourceId: id }),
  z.object({
    action: z.literal("observation.create"),
    sourceId: id,
    quote: text(4000),
    insight: text(2000),
    tags: z.array(text(40)).max(20),
    classification: z.enum(["finding", "hypothesis", "fictional"]),
    start: z.number().int().min(0),
  }),
  z.object({
    action: z.literal("persona.save"),
    projectId: id,
    personaId: id.optional(),
    expectedVersion: z.number().int().optional(),
    content: personaContent,
    note: z.string().max(300).optional(),
  }),
  z.object({
    action: z.literal("persona.restore"),
    personaId: id,
    revisionId: id,
    expectedVersion: version,
  }),
  z.object({
    action: z.literal("persona.review"),
    personaId: id,
    version,
    type: z.enum(["submit", "approve", "changes"]),
  }),
  z.object({ action: z.literal("persona.duplicate"), personaId: id }),
  z.object({ action: z.literal("persona.archive"), personaId: id }),
  z.object({
    action: z.literal("comment.add"),
    personaId: id,
    version,
    text: text(3000),
  }),
  z.object({ action: z.literal("comment.resolve"), commentId: id }),
  z.object({
    action: z.literal("publish"),
    personaId: id,
    version,
    days: z.number().int().min(1).max(365),
    passphrase: z.string().min(8).max(128).optional(),
    recipientEmail: z.email().optional(),
    membersOnly: z.boolean(),
  }),
  z.object({ action: z.literal("share.revoke"), shareId: id }),
  z.object({
    action: z.literal("export.create"),
    snapshotId: id,
    format: z.enum(["csv", "pdf"]),
  }),
  z.object({ action: z.literal("export.retry"), exportId: id }),
  z.object({
    action: z.literal("document.save"),
    projectId: id,
    documentId: id.optional(),
    expectedVersion: z.number().int().optional(),
    kind: z.enum(["journey", "brief"]),
    title: text(150),
    content: z.object({
      stages: z
        .array(
          z.object({
            name: text(100),
            goal: z.string().max(1000),
            friction: z.string().max(1000),
            opportunity: z.string().max(1000),
            observationIds: z.array(id).max(20),
          }),
        )
        .max(15),
      body: z.string().max(10000),
      personaIds: z.array(id).max(20),
      observationIds: z.array(id).max(50),
    }),
  }),
  z.object({
    action: z.literal("invite.create"),
    email: z.email(),
    role: z.enum(["owner", "editor", "viewer"]),
    projectIds: z.array(id).max(200),
  }),
  z.object({ action: z.literal("invite.revoke"), invitationId: id }),
  z.object({
    action: z.literal("member.change"),
    memberId: id,
    role: z.enum(["owner", "editor", "viewer", "remove"]),
  }),
  z.object({
    action: z.literal("workspace.update"),
    name: text(100),
    aiEnabled: z.boolean(),
    retentionDays: z.number().int().min(30).max(3650),
  }),
  z.object({
    action: z.literal("checkout"),
    plan: z.enum(["starter", "team", "agency"]),
  }),
  z.object({ action: z.literal("billing.portal") }),
  z.object({
    action: z.literal("support.create"),
    subject: text(180),
    text: text(6000),
  }),
  z.object({ action: z.literal("notification.read"), notificationId: id }),
  z.object({
    action: z.literal("ai"),
    projectId: id,
    mode: z.enum(["ask", "persona"]),
    question: text(2000),
    observationIds: z.array(id).min(1).max(40),
  }),
]);
export type Command = z.infer<typeof schema>;
export async function command(actor: Actor, workspaceId: string, raw: unknown) {
  const c = schema.parse(raw);
  switch (c.action) {
    case "project.create": {
      const membership = await workspaceAccess(actor, workspaceId, "editor");
      const subscription = membership.workspace.subscription;
      ensure(
        !subscription?.providerId ||
          (["active", "trialing"].includes(subscription.status) &&
            (!subscription.periodEnd || subscription.periodEnd > new Date())),
        402,
        "workspace_readonly",
        "Renew the workspace subscription before creating a project.",
      );
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${workspaceId} FOR UPDATE`;
        const sub = await tx.subscription.findUnique({
          where: { workspaceId },
        });
        ensure(
          (await tx.project.count({
            where: { workspaceId, archived: false },
          })) < effectivePlan(sub).projects,
          402,
          "project_limit",
          "This plan has reached its project allowance.",
        );
        const p = await tx.project.create({
          data: {
            workspaceId,
            name: c.name,
            description: c.description,
            restricted: c.restricted,
            viewerResearch: c.viewerResearch,
            members: { create: { userId: actor.id } },
          },
        });
        await tx.auditEvent.create({
          data: {
            workspaceId,
            actorId: actor.id,
            action: c.action,
            targetId: p.id,
          },
        });
        return { id: p.id };
      });
    }
    case "project.update": {
      await projectAccess(actor, workspaceId, c.projectId, "owner");
      ensure(
        c.memberIds.length ===
          (await db.membership.count({
            where: { workspaceId, userId: { in: c.memberIds } },
          })),
        422,
        "member_scope",
        "Select current workspace members.",
      );
      await db.$transaction(async (tx) => {
        await tx.project.update({
          where: { id: c.projectId },
          data: {
            name: c.name,
            description: c.description,
            restricted: c.restricted,
            viewerResearch: c.viewerResearch,
          },
        });
        await tx.projectMember.deleteMany({
          where: { projectId: c.projectId },
        });
        if (c.memberIds.length)
          await tx.projectMember.createMany({
            data: c.memberIds.map((userId) => ({
              projectId: c.projectId,
              userId,
            })),
          });
        await tx.auditEvent.create({
          data: {
            workspaceId,
            actorId: actor.id,
            action: c.action,
            targetId: c.projectId,
          },
        });
      });
      return { ok: true };
    }
    case "source.create": {
      await projectAccess(actor, workspaceId, c.projectId, "editor", true);
      const source = await db.$transaction(async (tx) => {
        await reserveSourceCapacity(
          tx,
          workspaceId,
          Buffer.byteLength(c.text, "utf8"),
        );
        const saved = await tx.researchSource.create({
          data: {
            workspaceId,
            projectId: c.projectId,
            title: c.title,
            kind: c.kind,
            text: c.text,
            bytes: Buffer.byteLength(c.text, "utf8"),
            participant: c.participant || null,
            tags: c.tags,
            classification: c.classification,
          },
        });
        await tx.auditEvent.create({
          data: {
            workspaceId,
            actorId: actor.id,
            action: c.action,
            targetId: saved.id,
          },
        });
        return saved;
      });
      return { id: source.id };
    }
    case "source.redact": {
      const { redactSource } = await import("./privacy");
      return redactSource(actor, workspaceId, c.sourceId, c.reason);
    }
    case "source.retry":
    case "source.delete": {
      const source = await db.researchSource.findFirst({
        where: { id: c.sourceId, workspaceId, deletedAt: null },
      });
      ensure(source, 404, "not_found", "Source is unavailable.");
      await projectAccess(
        actor,
        workspaceId,
        source.projectId,
        c.action === "source.delete" ? "owner" : "editor",
        true,
      );
      if (c.action === "source.delete") {
        const { redactSource } = await import("./privacy");
        return redactSource(
          actor,
          workspaceId,
          source.id,
          "Owner removed an uncited research source.",
          true,
        );
      }

      ensure(source.fileKey, 422, "no_file", "Paste a manual record instead.");
      await db.$transaction(async (tx) => {
        await tx.researchSource.update({
          where: { id: source.id },
          data: { status: "processing", failure: null },
        });
        await tx.job.upsert({
          where: { key: "extract:" + source.id },
          create: {
            key: "extract:" + source.id,
            kind: "extract",
            payload: { sourceId: source.id },
          },
          update: { status: "queued", attempts: 0, availableAt: new Date() },
        });
      });
      return { ok: true };
    }
    case "observation.create": {
      const source = await db.researchSource.findFirst({
        where: {
          id: c.sourceId,
          workspaceId,
          deletedAt: null,
          status: "ready",
        },
      });
      ensure(source, 404, "not_found", "Source is unavailable.");
      await projectAccess(actor, workspaceId, source.projectId, "editor", true);
      ensure(
        source.text.slice(c.start, c.start + c.quote.length) === c.quote,
        422,
        "quote_mismatch",
        "The quote must match an exact passage in the source.",
      );
      ensure(
        c.classification !== "finding" || source.classification === "finding",
        422,
        "classification",
        "A hypothesis or fictional source cannot support a research finding.",
      );
      const obs = await db.observation.create({
        data: {
          workspaceId,
          projectId: source.projectId,
          sourceId: source.id,
          quote: c.quote,
          start: Array.from(source.text.slice(0, c.start)).length,
          end:
            Array.from(source.text.slice(0, c.start)).length +
            Array.from(c.quote).length,
          insight: c.insight,
          tags: c.tags,
          classification: c.classification,
        },
      });
      return { id: obs.id };
    }
    case "persona.save":
      return savePersona(actor, workspaceId, c);
    case "persona.restore":
      return restorePersona(
        actor,
        workspaceId,
        c.personaId,
        c.revisionId,
        c.expectedVersion,
      );
    case "persona.review":
      await reviewPersona(actor, workspaceId, c.personaId, c.version, c.type);
      return { ok: true };
    case "persona.duplicate":
    case "persona.archive": {
      const p = await db.persona.findFirst({
        where: { id: c.personaId, workspaceId, deletedAt: null },
        include: { revisions: { take: 1, orderBy: { number: "desc" } } },
      });
      ensure(p, 404, "not_found", "Persona is unavailable.");
      await projectAccess(actor, workspaceId, p.projectId, "editor");
      if (c.action === "persona.archive") {
        await db.persona.update({
          where: { id: p.id },
          data: { deletedAt: new Date() },
        });
        return { ok: true };
      }
      const content = personaContent.parse(p.revisions[0].content);
      return savePersona(actor, workspaceId, {
        projectId: p.projectId,
        content: { ...content, name: content.name + " · copy" },
        note: "Duplicated from " + p.name,
      });
    }
    case "comment.add": {
      const p = await db.persona.findFirst({
        where: { id: c.personaId, workspaceId, deletedAt: null },
      });
      ensure(p, 404, "not_found", "Persona is unavailable.");
      await projectAccess(actor, workspaceId, p.projectId, "editor");
      const rev = await db.personaRevision.findUnique({
        where: { personaId_number: { personaId: p.id, number: c.version } },
      });
      ensure(rev, 404, "not_found", "Revision is unavailable.");
      return db.comment.create({
        data: {
          personaId: p.id,
          revisionId: rev.id,
          authorId: actor.id,
          authorName: actor.name,
          text: c.text,
        },
      });
    }
    case "comment.resolve": {
      const comment = await db.comment.findFirst({
        where: { id: c.commentId, persona: { workspaceId } },
        include: { persona: true },
      });
      ensure(comment, 404, "not_found", "Comment is unavailable.");
      await projectAccess(
        actor,
        workspaceId,
        comment.persona.projectId,
        "editor",
      );
      await db.comment.update({
        where: { id: comment.id },
        data: { resolved: true },
      });
      return { ok: true };
    }
    case "publish":
      return publishPersona(actor, workspaceId, c);
    case "share.revoke":
      await revokeShare(actor, workspaceId, c.shareId);
      return { ok: true };
    case "export.create": {
      const snapshot = await db.publishedSnapshot.findFirst({
        where: { id: c.snapshotId, workspaceId },
      });
      ensure(snapshot, 404, "not_found", "Snapshot is unavailable.");
      await projectAccess(
        actor,
        workspaceId,
        snapshot.projectId,
        "editor",
        false,
        true,
      );
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${workspaceId} FOR UPDATE`;
        const erasedEvidence = await tx.evidenceLink.count({
          where: {
            revision: {
              approval: { snapshots: { some: { id: snapshot.id } } },
            },
            observation: { source: { deletedAt: { not: null } } },
          },
        });
        ensure(
          !erasedEvidence,
          410,
          "export_revoked",
          "This snapshot contains redacted research. Approve a new draft before exporting.",
        );
        const job = await tx.exportJob.create({
          data: {
            snapshotId: snapshot.id,
            requestedBy: actor.id,
            format: c.format,
            expiresAt: new Date(Date.now() + 7 * 86400000),
          },
        });
        await tx.job.create({
          data: {
            key: "export:" + job.id,
            kind: "export",
            payload: { exportId: job.id },
          },
        });
        return { id: job.id };
      });
    }
    case "export.retry": {
      const exp = await db.exportJob.findFirst({
        where: {
          id: c.exportId,
          requestedBy: actor.id,
          snapshot: { workspaceId },
        },
        include: { snapshot: true },
      });
      ensure(exp, 404, "not_found", "Export is unavailable.");
      ensure(
        exp.status !== "revoked",
        410,
        "export_revoked",
        "This export was revoked through privacy redaction and cannot be retried.",
      );
      await projectAccess(
        actor,
        workspaceId,
        exp.snapshot.projectId,
        "editor",
        false,
        true,
      );
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${workspaceId} FOR UPDATE`;
        const changed = await tx.exportJob.updateMany({
          where: { id: exp.id, status: { not: "revoked" } },
          data: {
            status: "queued",
            failure: null,
            expiresAt: new Date(Date.now() + 7 * 86400000),
          },
        });
        ensure(
          changed.count,
          410,
          "export_revoked",
          "This export was revoked through privacy redaction.",
        );
        await tx.job.update({
          where: { key: "export:" + exp.id },
          data: { status: "queued", attempts: 0, availableAt: new Date() },
        });
      });
      return { ok: true };
    }
    case "document.save": {
      await projectAccess(actor, workspaceId, c.projectId, "editor");
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${workspaceId} FOR UPDATE`;
        const obsIds = [
          ...new Set([
            ...c.content.observationIds,
            ...c.content.stages.flatMap((s) => s.observationIds),
          ]),
        ];
        ensure(
          obsIds.length ===
            (await tx.observation.count({
              where: {
                workspaceId,
                projectId: c.projectId,
                id: { in: obsIds },
                source: { deletedAt: null },
              },
            })),
          422,
          "evidence_scope",
          "A document citation is unavailable.",
        );
        ensure(
          c.content.personaIds.length ===
            (await tx.persona.count({
              where: {
                workspaceId,
                projectId: c.projectId,
                id: { in: c.content.personaIds },
                deletedAt: null,
              },
            })),
          422,
          "persona_scope",
          "A linked persona is unavailable.",
        );
        if (c.documentId) {
          ensure(
            c.expectedVersion !== undefined,
            409,
            "conflict",
            "Reload the document before saving its next version.",
          );
          const changed = await tx.projectDocument.updateMany({
            where: {
              id: c.documentId,
              workspaceId,
              projectId: c.projectId,
              version: c.expectedVersion,
            },
            data: {
              title: c.title,
              content: c.content,
              version: { increment: 1 },
            },
          });
          ensure(
            changed.count,
            409,
            "conflict",
            "This document changed. Reload before saving.",
          );
          return { id: c.documentId };
        }
        return tx.projectDocument.create({
          data: {
            workspaceId,
            projectId: c.projectId,
            title: c.title,
            kind: c.kind,
            content: c.content,
          },
        });
      });
    }

    case "invite.create":
      return createInvitation(actor, workspaceId, c);
    case "invite.revoke":
      await workspaceAccess(actor, workspaceId, "owner");
      await db.invitation.updateMany({
        where: { id: c.invitationId, workspaceId, acceptedAt: null },
        data: { revokedAt: new Date() },
      });
      return { ok: true };
    case "member.change":
      await changeMember(actor, workspaceId, c.memberId, c.role);
      return { ok: true };
    case "workspace.update":
      await workspaceAccess(actor, workspaceId, "owner");
      await db.$transaction([
        db.workspace.update({
          where: { id: workspaceId },
          data: {
            name: c.name,
            aiEnabled: c.aiEnabled,
            retentionDays: c.retentionDays,
          },
        }),
        db.auditEvent.create({
          data: {
            workspaceId,
            actorId: actor.id,
            action: c.action,
            targetId: workspaceId,
            detail: { aiEnabled: c.aiEnabled, retentionDays: c.retentionDays },
          },
        }),
      ]);
      return { ok: true };
    case "checkout":
      return checkout(actor, workspaceId, c.plan);
    case "billing.portal":
      return billingPortal(actor, workspaceId);
    case "support.create": {
      await workspaceAccess(actor, workspaceId);
      const request = await db.supportRequest.create({
        data: {
          workspaceId,
          userId: actor.id,
          email: actor.email,
          subject: c.subject,
          text: c.text,
        },
      });
      return { id: request.id };
    }
    case "notification.read":
      await workspaceAccess(actor, workspaceId);
      await db.notification.updateMany({
        where: { id: c.notificationId, userId: actor.id, workspaceId },
        data: { readAt: new Date() },
      });
      return { ok: true };
    case "ai":
      return assist(actor, workspaceId, c);
  }
}
