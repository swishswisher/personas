import type { Prisma } from "@/generated/prisma/client";
import { personaContent } from "@/lib/domain";
import { db } from "./db";
import { workspaceAccess, projectAccess, type Actor } from "./security";
import { effectivePlan } from "./subscriptions";
import { ensure } from "@/lib/domain";
export async function workspaceData(
  actor: Actor,
  workspaceId: string,
  projectId?: string,
  query = "",
  options: {
    page?: number;
    personaId?: string;
    sourceId?: string;
    kind?: string;
    status?: string;
  } = {},
) {
  const m = await workspaceAccess(actor, workspaceId);
  const retentionReviewBefore = new Date(
    Date.now() - m.workspace.retentionDays * 86400000,
  );
  const projects = await db.project.findMany({
    where: {
      workspaceId,
      archived: false,
      ...(m.role === "owner"
        ? {}
        : {
            OR: [
              { restricted: false },
              { members: { some: { userId: actor.id } } },
            ],
          }),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { members: { select: { userId: true } } },
  });
  const selected = projectId
    ? projects.find((p) => p.id === projectId)
    : projects[0];
  if (projectId) ensure(selected, 404, "not_found", "Project is unavailable.");
  const ids = selected ? [selected.id] : [];
  const research = projects
    .filter(
      (p) => ids.includes(p.id) && (m.role !== "viewer" || p.viewerResearch),
    )
    .map((p) => p.id);
  const scope = { workspaceId, projectId: { in: ids } };
  const page = Math.max(1, Math.min(100, options.page || 1));
  const sourceWhere: Prisma.ResearchSourceWhereInput = {
    workspaceId,
    projectId: { in: research },
    deletedAt: null,
    ...(options.kind ? { kind: options.kind } : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { text: { contains: query, mode: "insensitive" } },
            { tags: { has: query } },
          ],
        }
      : {}),
  };
  const personaWhere: Prisma.PersonaWhereInput = {
    ...scope,
    deletedAt: null,
    ...(options.personaId ? { id: options.personaId } : {}),
    ...(options.status ? { status: options.status } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { summary: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const countsPromise = Promise.all([
    db.researchSource.count({
      where: { workspaceId, projectId: { in: research }, deletedAt: null },
    }),
    db.persona.count({ where: { ...scope, deletedAt: null } }),
    db.persona.count({
      where: { ...scope, deletedAt: null, status: "review" },
    }),
    db.publishedSnapshot.count({ where: scope }),
    db.researchSource.groupBy({
      by: ["participant"],
      where: {
        workspaceId,
        projectId: { in: research },
        deletedAt: null,
        participant: { not: null },
      },
    }),
    db.researchSource.count({ where: sourceWhere }),
    db.persona.count({ where: personaWhere }),
    db.researchSource.count({
      where: {
        workspaceId,
        projectId: { in: research },
        deletedAt: null,
        createdAt: {
          lte: retentionReviewBefore,
        },
      },
    }),
  ]);
  const [
    sources,
    observations,
    personas,
    documents,
    shares,
    snapshots,
    exports,
    team,
    invitations,
    notifications,
    support,
    audit,
    usage,
  ] = await Promise.all([
    db.researchSource.findMany({
      where: sourceWhere,
      skip: (page - 1) * 100,
      select: {
        id: true,
        title: true,
        kind: true,
        participant: true,
        tags: true,
        classification: true,
        projectId: true,
        status: true,
        failure: true,
        fileName: true,
        bytes: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.observation.findMany({
      where: {
        workspaceId,
        projectId: { in: research },
        source: { deletedAt: null },
        ...(options.sourceId ? { sourceId: options.sourceId } : {}),
      },
      include: {
        source: { select: { id: true, title: true, participant: true } },
      },
      take: 300,
      orderBy: { createdAt: "desc" },
    }),
    db.persona.findMany({
      where: personaWhere,
      skip: options.personaId ? 0 : (page - 1) * 100,
      include: {
        revisions: {
          take: 1,
          orderBy: { number: "desc" },
          include: { approval: true },
        },
      },
      take: 100,
      orderBy: { updatedAt: "desc" },
    }),
    db.projectDocument.findMany({
      where: scope,
      take: 100,
      orderBy: { updatedAt: "desc" },
    }),
    m.role === "owner"
      ? db.shareGrant.findMany({
          where: { snapshot: scope },
          select: {
            id: true,
            snapshotId: true,
            recipientEmail: true,
            membersOnly: true,
            expiresAt: true,
            revokedAt: true,
            createdAt: true,
          },
          take: 100,
          orderBy: { createdAt: "desc" },
        })
      : [],
    db.publishedSnapshot.findMany({
      where: scope,
      include: {
        approval: {
          include: { revision: { select: { number: true, personaId: true } } },
        },
      },
      take: 100,
      orderBy: { createdAt: "desc" },
    }),
    db.exportJob.findMany({
      where: { requestedBy: actor.id, snapshot: scope },
      select: {
        id: true,
        snapshotId: true,
        format: true,
        status: true,
        expiresAt: true,
        failure: true,
        createdAt: true,
      },
      take: 100,
      orderBy: { createdAt: "desc" },
    }),
    m.role === "owner"
      ? db.membership.findMany({
          where: { workspaceId },
          include: { user: { select: { id: true, name: true, email: true } } },
          take: 200,
        })
      : [],
    m.role === "owner"
      ? db.invitation.findMany({
          where: {
            workspaceId,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: {
            id: true,
            email: true,
            role: true,
            projectIds: true,
            expiresAt: true,
          },
          take: 100,
        })
      : [],
    db.notification.findMany({
      where: { userId: actor.id, workspaceId },
      take: 40,
      orderBy: { createdAt: "desc" },
    }),
    db.supportRequest.findMany({
      where: {
        workspaceId,
        ...(m.role === "owner" ? {} : { userId: actor.id }),
      },
      take: 30,
      orderBy: { createdAt: "desc" },
    }),
    m.role === "owner"
      ? db.auditEvent.findMany({
          where: { workspaceId },
          take: 40,
          orderBy: { createdAt: "desc" },
        })
      : [],
    db.usage.findUnique({
      where: {
        workspaceId_period: {
          workspaceId,
          period: new Date().toISOString().slice(0, 7),
        },
      },
    }),
  ]);
  const [
    sourceCount,
    personaCount,
    reviewCount,
    snapshotCount,
    participants,
    sourceMatches,
    personaMatches,
    retentionDue,
  ] = await countsPromise;
  const linkedIds = options.personaId
    ? personas.flatMap((p) =>
        personaContent
          .parse(p.revisions[0].content)
          .claims.flatMap((cl) => cl.observationIds),
      )
    : [];
  const extraObservations = linkedIds.length
    ? await db.observation.findMany({
        where: {
          id: { in: linkedIds, notIn: observations.map((o) => o.id) },
          workspaceId,
          projectId: { in: research },
          source: { deletedAt: null },
        },
        include: {
          source: { select: { id: true, title: true, participant: true } },
        },
      })
    : [];
  return {
    workspace: {
      id: m.workspace.id,
      name: m.workspace.name,
      demo: m.workspace.demo,
      aiEnabled: m.workspace.aiEnabled,
      retentionDays: m.workspace.retentionDays,
      retentionReviewBefore,
    },
    role: m.role,
    pagination: { page, sourceMatches, personaMatches },
    counts: {
      sources: sourceCount,
      personas: personaCount,
      review: reviewCount,
      snapshots: snapshotCount,
      participants: participants.length,
      retentionDue,
    },
    projects,
    selectedProject: selected?.id || null,
    sources,
    observations: [...observations, ...extraObservations],
    personas,
    documents,
    shares,
    snapshots,
    exports,
    team,
    invitations,
    notifications,
    support,
    audit,
    subscription:
      m.role === "owner"
        ? m.workspace.subscription
          ? {
              plan: m.workspace.subscription.plan,
              status: m.workspace.subscription.status,
              seats: m.workspace.subscription.seats,
              cancelAtEnd: m.workspace.subscription.cancelAtEnd,
              periodEnd: m.workspace.subscription.periodEnd,
            }
          : null
        : null,
    limits: effectivePlan(m.workspace.subscription),
    usage: usage?.aiCalls || 0,
    integrations: {
      ai: !!(process.env.AI_GATEWAY_API_KEY && process.env.AI_MODEL),
      billing: !!process.env.STRIPE_SECRET_KEY,
      email: !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    },
  };
}
export async function sourceDetail(
  actor: Actor,
  workspaceId: string,
  id: string,
) {
  const source = await db.researchSource.findFirst({
    where: { id, workspaceId, deletedAt: null },
    omit: { fileKey: true },
  });
  ensure(source, 404, "not_found", "Research source is unavailable.");
  await projectAccess(actor, workspaceId, source.projectId, "viewer", true);
  return source;
}
export async function personaHistory(
  actor: Actor,
  workspaceId: string,
  id: string,
) {
  const persona = await db.persona.findFirst({
    where: { id, workspaceId, deletedAt: null },
  });
  ensure(persona, 404, "not_found", "Persona is unavailable.");
  await projectAccess(actor, workspaceId, persona.projectId);
  const revisions = await db.personaRevision.findMany({
    where: { personaId: id, workspaceId },
    include: { approval: true },
    orderBy: { number: "desc" },
    take: 100,
  });
  const comments = await db.comment.findMany({
    where: { personaId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return { revisions, comments };
}
