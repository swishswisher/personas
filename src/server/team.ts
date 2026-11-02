import { appUrl } from "./config";
import { z } from "zod";
import { db } from "./db";
import { workspaceAccess, hashToken, newToken, type Actor } from "./security";
import { ensure, roleSchema } from "@/lib/domain";
import { effectivePlan } from "./subscriptions";
export async function createInvitation(
  actor: Actor,
  workspaceId: string,
  input: { email: string; role: string; projectIds: string[] },
) {
  const m = await workspaceAccess(actor, workspaceId, "owner");
  const role = roleSchema.parse(input.role);
  const email = z.email().parse(input.email.toLowerCase());
  ensure(
    input.projectIds.length ===
      (await db.project.count({
        where: { id: { in: input.projectIds }, workspaceId },
      })),
    422,
    "project_scope",
    "An invited project is unavailable.",
  );
  const token = newToken();
  const invitation = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${workspaceId} FOR UPDATE`;
    const sub = await tx.subscription.findUnique({ where: { workspaceId } });
    const limit = effectivePlan(sub).seats;
    const occupied = await tx.membership.count({
      where: { workspaceId, role: { in: ["owner", "editor"] } },
    });
    const pending = await tx.invitation.count({
      where: {
        workspaceId,
        role: { in: ["owner", "editor"] },
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    ensure(
      role === "viewer" || occupied + pending < limit,
      402,
      "seat_limit",
      "All editing seats are in use or reserved by pending invitations.",
    );
    ensure(
      !(await tx.membership.findFirst({
        where: { workspaceId, user: { email } },
      })),
      409,
      "already_member",
      "This person already belongs to the workspace.",
    );
    const result = await tx.invitation.create({
      data: {
        workspaceId,
        email,
        role,
        projectIds: input.projectIds,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    const url = `${appUrl()}/invite?token=${token}`;
    await tx.job.create({
      data: {
        key: "invite:" + result.id,
        kind: "email",
        payload: {
          to: email,
          subject: `You’re invited to ${m.workspace.name}`,
          text: `${actor.name} invited you as ${role}. Sign in with ${email} and accept this invitation before ${result.expiresAt.toISOString()}:\n${url}`,
        },
      },
    });
    await tx.auditEvent.create({
      data: {
        workspaceId,
        actorId: actor.id,
        action: "invitation.created",
        targetId: result.id,
      },
    });
    return result;
  });
  return {
    id: invitation.id,
    url: `${appUrl()}/invite?token=${token}`,
  };
}
export async function acceptInvitation(actor: Actor, token: string) {
  ensure(
    actor.emailVerified,
    403,
    "email_verification",
    "Verify your email before accepting.",
  );
  return db.$transaction(async (tx) => {
    const initial = await tx.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    ensure(initial, 410, "invalid_invite", "This invitation is unavailable.");
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${initial.workspaceId} FOR UPDATE`;
    const invite = await tx.invitation.findUniqueOrThrow({
      where: { id: initial.id },
    });
    ensure(
      !invite.acceptedAt && !invite.revokedAt && invite.expiresAt > new Date(),
      410,
      "expired_invite",
      "This invitation has expired, was revoked, or was already used.",
    );
    ensure(
      invite.email === actor.email.toLowerCase(),
      403,
      "invite_identity",
      "Sign in with the email address this invitation was sent to.",
    );
    const existing = await tx.membership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspaceId,
          userId: actor.id,
        },
      },
    });
    ensure(
      !existing,
      409,
      "already_member",
      "You already belong to this workspace.",
    );
    const sub = await tx.subscription.findUnique({
      where: { workspaceId: invite.workspaceId },
    });
    const count = await tx.membership.count({
      where: {
        workspaceId: invite.workspaceId,
        role: { in: ["owner", "editor"] },
      },
    });
    ensure(
      invite.role === "viewer" || count < effectivePlan(sub).seats,
      402,
      "seat_limit",
      "An editing seat is no longer available. Ask the owner to free a seat.",
    );
    await tx.membership.create({
      data: {
        workspaceId: invite.workspaceId,
        userId: actor.id,
        role: invite.role,
      },
    });
    for (const projectId of invite.projectIds) {
      const project = await tx.project.findFirst({
        where: { id: projectId, workspaceId: invite.workspaceId },
      });
      ensure(
        project,
        409,
        "project_scope",
        "The invitation project is unavailable.",
      );
      await tx.projectMember.create({ data: { projectId, userId: actor.id } });
    }
    await tx.invitation.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    await tx.auditEvent.create({
      data: {
        workspaceId: invite.workspaceId,
        actorId: actor.id,
        action: "invitation.accepted",
        targetId: invite.id,
      },
    });
    return { workspaceId: invite.workspaceId };
  });
}
export async function changeMember(
  actor: Actor,
  workspaceId: string,
  memberId: string,
  role: string | "remove",
) {
  await workspaceAccess(actor, workspaceId, "owner");
  if (role !== "remove") roleSchema.parse(role);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${workspaceId} FOR UPDATE`;
    const member = await tx.membership.findFirst({
      where: { id: memberId, workspaceId },
    });
    ensure(member, 404, "not_found", "Membership is unavailable.");
    if (member.role === "owner" && role !== "owner")
      ensure(
        (await tx.membership.count({ where: { workspaceId, role: "owner" } })) >
          1,
        409,
        "last_owner",
        "The workspace must retain at least one owner.",
      );
    if (member.role === "viewer" && role !== "viewer" && role !== "remove") {
      const sub = await tx.subscription.findUnique({ where: { workspaceId } });
      ensure(
        (await tx.membership.count({
          where: { workspaceId, role: { in: ["owner", "editor"] } },
        })) < effectivePlan(sub).seats,
        402,
        "seat_limit",
        "No editing seat is available.",
      );
    }
    if (role === "remove") {
      await tx.projectMember.deleteMany({
        where: { userId: member.userId, project: { workspaceId } },
      });
      await tx.membership.delete({ where: { id: member.id } });
    } else
      await tx.membership.update({ where: { id: member.id }, data: { role } });
    await tx.auditEvent.create({
      data: {
        workspaceId,
        actorId: actor.id,
        action: "membership." + role,
        targetId: member.id,
      },
    });
  });
}
