import { db } from "./db";
import { workspaceAccess, type Actor } from "./security";
import { ensure } from "@/lib/domain";
export async function redactSource(
  actor: Actor,
  workspaceId: string,
  sourceId: string,
  reason: string,
) {
  await workspaceAccess(actor, workspaceId, "owner");
  ensure(
    reason.trim().length >= 10,
    422,
    "redaction_reason",
    "Record a reason of at least 10 characters.",
  );
  return db.$transaction(async (tx) => {
    const source = await tx.researchSource.findFirst({
      where: { id: sourceId, workspaceId, deletedAt: null },
    });
    ensure(source, 404, "not_found", "Source is unavailable.");
    const affected = await tx.personaRevision.findMany({
      where: { workspaceId, evidence: { some: { observation: { sourceId } } } },
      select: { personaId: true },
    });
    const personaIds = [...new Set(affected.map((r) => r.personaId))];
    const audit = await tx.auditEvent.create({
      data: {
        workspaceId,
        actorId: actor.id,
        action: "privacy.redacted",
        targetId: sourceId,
        detail: { reason, affectedPersonas: personaIds.length },
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
        status: "redacted",
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
    };
  });
}
