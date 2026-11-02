import { appUrl } from "./config";
import { db } from "./db";
import {
  type Actor,
  projectAccess,
  workspaceAccess,
  newToken,
  hashToken,
  hashPassphrase,
  checkPassphrase,
} from "./security";
import { ensure, personaContent } from "@/lib/domain";
export async function publishPersona(
  actor: Actor,
  workspaceId: string,
  input: {
    personaId: string;
    version: number;
    days: number;
    passphrase?: string;
    recipientEmail?: string;
    membersOnly: boolean;
  },
) {
  const persona = await db.persona.findFirst({
    where: { id: input.personaId, workspaceId, deletedAt: null },
  });
  ensure(persona, 404, "not_found", "Persona is unavailable.");
  await projectAccess(actor, workspaceId, persona.projectId, "owner");
  const token = newToken();
  const passphraseHash = input.passphrase
    ? hashPassphrase(input.passphrase)
    : null;
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Persona" WHERE id=${persona.id} FOR UPDATE`;
    const current = await tx.persona.findUniqueOrThrow({
      where: { id: persona.id },
    });
    ensure(
      current.status === "approved" && current.version === input.version,
      409,
      "not_approved",
      "Approve the current revision before publishing.",
    );
    const revision = await tx.personaRevision.findUniqueOrThrow({
      where: {
        personaId_number: { personaId: persona.id, number: input.version },
      },
      include: { approval: true },
    });
    ensure(
      revision.approval,
      409,
      "not_approved",
      "This exact revision has not been approved.",
    );
    const content = personaContent.parse(revision.content);
    // Public snapshots contain selected persona content and references, never source transcripts or participant identities.
    const snapshot = await tx.publishedSnapshot.create({
      data: {
        workspaceId,
        projectId: persona.projectId,
        approvalId: revision.approval.id,
        content: {
          ...content,
          revision: revision.number,
          publishedAt: new Date().toISOString(),
        },
      },
    });
    const share = await tx.shareGrant.create({
      data: {
        snapshotId: snapshot.id,
        tokenHash: hashToken(token),
        passphraseHash,
        recipientEmail: input.recipientEmail?.toLowerCase() || null,
        membersOnly: input.membersOnly,
        expiresAt: new Date(Date.now() + input.days * 86400000),
      },
    });
    await tx.auditEvent.create({
      data: {
        workspaceId,
        actorId: actor.id,
        action: "snapshot.published",
        targetId: snapshot.id,
        detail: { shareId: share.id, revision: input.version },
      },
    });
    return { snapshotId: snapshot.id, shareId: share.id };
  });
  return { ...result, url: `${appUrl()}/share/${token}` };
}
export async function readShare(
  token: string,
  actor: Actor | null,
  passphrase?: string,
) {
  const grant = await db.shareGrant.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { snapshot: true },
  });
  ensure(
    grant && !grant.revokedAt && grant.expiresAt > new Date(),
    410,
    "share_unavailable",
    "This share has expired or been revoked.",
  );
  if (grant.recipientEmail)
    ensure(
      actor?.emailVerified &&
        actor.email.toLowerCase() === grant.recipientEmail,
      403,
      "recipient_required",
      "Sign in with the invited email address to view this snapshot.",
    );
  if (grant.membersOnly) {
    ensure(actor, 401, "login_required", "Sign in to view this snapshot.");
    await projectAccess(
      actor,
      grant.snapshot.workspaceId,
      grant.snapshot.projectId,
    );
  }
  if (grant.passphraseHash)
    ensure(
      passphrase && checkPassphrase(passphrase, grant.passphraseHash),
      403,
      "passphrase_required",
      "Enter the passphrase supplied by the workspace owner.",
    );
  return {
    content: grant.snapshot.content,
    createdAt: grant.snapshot.createdAt,
  };
}
export async function revokeShare(
  actor: Actor,
  workspaceId: string,
  shareId: string,
) {
  await workspaceAccess(actor, workspaceId, "owner");
  const share = await db.shareGrant.findFirst({
    where: { id: shareId, snapshot: { workspaceId } },
    include: { snapshot: true },
  });
  ensure(share, 404, "not_found", "Share is unavailable.");
  await projectAccess(actor, workspaceId, share.snapshot.projectId, "owner");
  await db.$transaction([
    db.shareGrant.update({
      where: { id: shareId },
      data: { revokedAt: new Date() },
    }),
    db.auditEvent.create({
      data: {
        workspaceId,
        actorId: actor.id,
        action: "share.revoked",
        targetId: shareId,
      },
    }),
  ]);
}
