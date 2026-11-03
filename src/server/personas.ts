import { db } from "./db";
import { projectAccess, type Actor } from "./security";
import {
  ensure,
  personaContent,
  validateEvidence,
  type PersonaContent,
} from "@/lib/domain";
import { notifyInTransaction } from "./outbox";
export async function savePersona(
  actor: Actor,
  workspaceId: string,
  input: {
    projectId: string;
    personaId?: string;
    expectedVersion?: number;
    content: PersonaContent;
    note?: string;
  },
) {
  await projectAccess(actor, workspaceId, input.projectId, "editor");
  const content = personaContent.parse(input.content);
  const observationIds = [
    ...new Set(content.claims.flatMap((c) => c.observationIds)),
  ];
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${workspaceId} FOR UPDATE`;
    // Recheck evidence under the same lock as privacy erasure. A preflight
    // read could otherwise let a waiting save reintroduce erased content.
    const observations = await tx.observation.findMany({
      where: {
        id: { in: observationIds },
        workspaceId,
        projectId: input.projectId,
        source: { deletedAt: null, status: "ready" },
      },
    });
    validateEvidence(content, observations);
    let persona = input.personaId
      ? await tx.persona.findFirst({
          where: {
            id: input.personaId,
            workspaceId,
            projectId: input.projectId,
            deletedAt: null,
          },
        })
      : null;
    if (input.personaId)
      ensure(persona, 404, "not_found", "Persona is unavailable.");
    if (persona)
      ensure(
        persona.version === input.expectedVersion,
        409,
        "conflict",
        "This persona changed while you were editing. Reload and compare the latest revision before saving.",
      );
    else {
      const { effectivePlan } = await import("./subscriptions");
      const subscription = await tx.subscription.findUnique({
        where: { workspaceId },
      });
      const limits = effectivePlan(subscription);
      const count = await tx.persona.count({
        where: { workspaceId, deletedAt: null },
      });
      ensure(
        count < limits.personas,
        402,
        "plan_limit",
        "This workspace has reached its saved persona allowance.",
      );
      persona = await tx.persona.create({
        data: { workspaceId, projectId: input.projectId, name: content.name },
      });
    }
    const version = persona.version + 1;
    await tx.persona.update({
      where: { id: persona.id },
      data: {
        name: content.name,
        summary: content.summary,
        classification: content.classification,
        status: "draft",
        version,
      },
    });
    const revision = await tx.personaRevision.create({
      data: {
        workspaceId,
        projectId: input.projectId,
        personaId: persona.id,
        number: version,
        authorId: actor.id,
        content,
        note: input.note || "Saved draft",
      },
    });
    if (observationIds.length)
      await tx.evidenceLink.createMany({
        data: observationIds.map((observationId) => ({
          workspaceId,
          projectId: input.projectId,
          revisionId: revision.id,
          observationId,
        })),
      });
    await tx.auditEvent.create({
      data: {
        workspaceId,
        actorId: actor.id,
        action: "persona.saved",
        targetId: persona.id,
        detail: { revision: version },
      },
    });
    return { id: persona.id, version };
  });
}
export async function reviewPersona(
  actor: Actor,
  workspaceId: string,
  personaId: string,
  version: number,
  action: "submit" | "approve" | "changes",
) {
  const persona = await db.persona.findFirst({
    where: { id: personaId, workspaceId, deletedAt: null },
  });
  ensure(persona, 404, "not_found", "Persona is unavailable.");
  await projectAccess(
    actor,
    workspaceId,
    persona.projectId,
    action === "submit" ? "editor" : "owner",
  );
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${workspaceId} FOR UPDATE`;
    const current = await tx.persona.findUniqueOrThrow({
      where: { id: personaId },
    });
    const changed = await tx.persona.updateMany({
      where: {
        id: personaId,
        workspaceId,
        deletedAt: null,
        version,
        status:
          action === "submit"
            ? { in: ["draft", "changes_requested"] }
            : "review",
      },
      data: {
        status:
          action === "submit"
            ? "review"
            : action === "approve"
              ? "approved"
              : "changes_requested",
      },
    });
    ensure(
      changed.count,
      409,
      "review_conflict",
      "The review state or revision changed. Refresh before continuing.",
    );
    const revision = await tx.personaRevision.findUniqueOrThrow({
      where: { personaId_number: { personaId, number: version } },
    });
    if (action === "approve")
      await tx.approval.create({
        data: { revisionId: revision.id, approverId: actor.id },
      });
    await notifyInTransaction(
      tx,
      workspaceId,
      action === "submit"
        ? "Persona ready for review"
        : action === "approve"
          ? "Persona approved"
          : "Changes requested",
      `${current.name} · revision ${version}`,
      `/app/persona?id=${personaId}&project=${persona.projectId}`,
      persona.projectId,
    );
    await tx.auditEvent.create({
      data: {
        workspaceId,
        actorId: actor.id,
        action: "persona." + action,
        targetId: personaId,
        detail: { revision: version },
      },
    });
  });
}
export async function restorePersona(
  actor: Actor,
  workspaceId: string,
  personaId: string,
  revisionId: string,
  expectedVersion: number,
) {
  const persona = await db.persona.findFirst({
    where: { id: personaId, workspaceId, deletedAt: null },
  });
  ensure(persona, 404, "not_found", "Persona is unavailable.");
  await projectAccess(actor, workspaceId, persona.projectId, "editor");
  const revision = await db.personaRevision.findFirst({
    where: { id: revisionId, personaId, workspaceId },
  });
  ensure(revision, 404, "not_found", "Revision is unavailable.");
  return savePersona(actor, workspaceId, {
    personaId,
    projectId: persona.projectId,
    expectedVersion,
    content: personaContent.parse(revision.content),
    note: `Restored revision ${revision.number}`,
  });
}
