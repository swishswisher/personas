import { db } from "./db";
import { workspaceAccess, type Actor } from "./security";
import { ensure } from "@/lib/domain";
import { z } from "zod";
const documentLinks = z.object({
  observationIds: z.array(z.string()).default([]),
  personaIds: z.array(z.string()).default([]),
  stages: z
    .array(z.object({ observationIds: z.array(z.string()).default([]) }))
    .default([]),
});
export async function redactSource(
  actor: Actor,
  workspaceId: string,
  sourceId: string,
  reason: string,
  uncitedOnly = false,
) {
  await workspaceAccess(actor, workspaceId, "owner");
  ensure(
    reason.trim().length >= 10,
    422,
    "redaction_reason",
    "Record a reason of at least 10 characters.",
  );
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${workspaceId} FOR UPDATE`;
    const source = await tx.researchSource.findFirst({
      where: { id: sourceId, workspaceId, deletedAt: null },
    });
    ensure(source, 404, "not_found", "Source is unavailable.");
    const affected = await tx.personaRevision.findMany({
      where: { workspaceId, evidence: { some: { observation: { sourceId } } } },
      select: { personaId: true },
    });
    const personaIds = [...new Set(affected.map((r) => r.personaId))];
    ensure(
      !uncitedOnly || !personaIds.length,
      409,
      "retained_evidence",
      "This source supports saved persona revisions. Use the explicit privacy-redaction action to remove the source and affected insights.",
    );
    const observations = await tx.observation.findMany({
      where: { sourceId },
      select: { id: true },
    });
    const observationIds = new Set(observations.map((o) => o.id));
    const documents = await tx.projectDocument.findMany({
      where: { workspaceId, projectId: source.projectId },
    });
    const affectedDocuments = documents.filter((d) => {
      const parsed = documentLinks.safeParse(d.content);
      if (!parsed.success) return false;
      return (
        parsed.data.personaIds.some((id) => personaIds.includes(id)) ||
        [
          ...parsed.data.observationIds,
          ...parsed.data.stages.flatMap((s) => s.observationIds),
        ].some((id) => observationIds.has(id))
      );
    });
    const audit = await tx.auditEvent.create({
      data: {
        workspaceId,
        actorId: actor.id,
        action: "privacy.redacted",
        targetId: sourceId,
        detail: {
          reason,
          affectedPersonas: personaIds.length,
          affectedDocuments: affectedDocuments.length,
        },
      },
    });
    await tx.$queryRaw`SELECT set_config('personas.redaction_id',${audit.id},true)`;
    const revisions = await tx.personaRevision.findMany({
      where: { personaId: { in: personaIds } },
      select: { id: true, number: true },
    });
    const snapshots = await tx.publishedSnapshot.findMany({
      where: {
        workspaceId,
        approval: { revision: { personaId: { in: personaIds } } },
      },
      include: { exports: true },
    });
    await tx.shareGrant.updateMany({
      where: { snapshotId: { in: snapshots.map((s) => s.id) } },
      data: { revokedAt: new Date() },
    });
    for (const s of snapshots) {
      await tx.exportJob.updateMany({
        where: { snapshotId: s.id },
        data: { status: "revoked" },
      });
      for (const exp of s.exports)
        if (exp.fileKey)
          await tx.job.upsert({
            where: { key: "delete:" + exp.fileKey },
            create: {
              key: "delete:" + exp.fileKey,
              kind: "delete_file",
              payload: { fileKey: exp.fileKey },
            },
            update: {},
          });
    }
    const replacement = {
      name: "Redacted persona",
      subtitle: "Content removed after a privacy request",
      summary:
        "This content was removed through an audited privacy redaction. Create a new draft with permitted evidence.",
      classification: "hypothesis",
      claims: [],
    };
    for (const r of revisions)
      await tx.personaRevision.update({
        where: { id: r.id },
        data: {
          content: replacement,
          note: "Content removed through recorded privacy redaction",
        },
      });
    for (const s of snapshots)
      await tx.publishedSnapshot.update({
        where: { id: s.id },
        data: { content: replacement },
      });
    await tx.persona.updateMany({
      where: { id: { in: personaIds } },
      data: {
        name: replacement.name,
        summary: replacement.summary,
        classification: "hypothesis",
        status: "draft",
      },
    });
    await tx.comment.updateMany({
      where: { personaId: { in: personaIds } },
      data: { text: "Comment removed with associated research content." },
    });
    for (const document of affectedDocuments)
      await tx.projectDocument.update({
        where: { id: document.id },
        data: {
          title: "Redacted research document",
          content: {
            body: "Removed through privacy redaction. Create a new document using permitted evidence.",
            stages: [],
            personaIds: [],
            observationIds: [],
          },
          version: { increment: 1 },
        },
      });
    const notifications = personaIds.length
      ? await tx.notification.findMany({
          where: {
            workspaceId,
            OR: personaIds.map((id) => ({ href: { contains: `id=${id}&` } })),
          },
          select: { id: true },
        })
      : [];
    for (const notification of notifications) {
      await tx.notification.update({
        where: { id: notification.id },
        data: { text: "Associated content removed through privacy redaction." },
      });
      await tx.job.updateMany({
        where: { key: "notification:" + notification.id },
        data: {
          payload: { redacted: true },
          status: "complete",
          completedAt: new Date(),
        },
      });
    }
    await tx.observation.updateMany({
      where: { sourceId },
      data: {
        quote: "[redacted]",
        insight: "Removed through privacy redaction",
        start: 0,
        end: 10,
        tags: [],
        classification: "hypothesis",
      },
    });
    await tx.researchSource.update({
      where: { id: sourceId },
      data: {
        text: "",
        title: "Redacted research source",
        participant: null,
        tags: [],
        deletedAt: new Date(),
        fileKey: null,
        fileName: null,
        failure: null,
        status: uncitedOnly ? "deleted" : "redacted",
      },
    });
    if (source.fileKey)
      await tx.job.upsert({
        where: { key: "delete:" + source.fileKey },
        create: {
          key: "delete:" + source.fileKey,
          kind: "delete_file",
          payload: { fileKey: source.fileKey },
        },
        update: {},
      });
    return {
      redacted: true,
      affectedPersonas: personaIds.length,
      revokedSnapshots: snapshots.length,
      affectedDocuments: affectedDocuments.length,
    };
  });
}
