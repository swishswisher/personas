import { appUrl } from "./config";
import { db } from "./db";
import type { Prisma } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
export async function queueMail(
  to: string,
  subject: string,
  text: string,
  key = randomUUID(),
  client: import("./db").Tx | typeof db = db,
) {
  await client.job.upsert({
    where: { key: "mail:" + key },
    create: {
      key: "mail:" + key,
      kind: "email",
      payload: { to, subject, text },
    },
    update: {},
  });
}
export async function notify(
  workspaceId: string,
  title: string,
  text: string,
  href = "/app",
) {
  const members = await db.membership.findMany({
    where: { workspaceId },
    include: { user: true },
  });
  await db.$transaction(async (tx) => {
    for (const member of members) {
      const n = await tx.notification.create({
        data: { workspaceId, userId: member.userId, title, text, href },
      });
      await tx.job.create({
        data: {
          key: "notification:" + n.id,
          kind: "email",
          payload: {
            to: member.user.email,
            subject: title,
            text: text + "\n" + appUrl() + href,
          } as Prisma.InputJsonValue,
        },
      });
    }
  });
}

export async function notifyInTransaction(
  tx: import("./db").Tx,
  workspaceId: string,
  title: string,
  text: string,
  href: string,
  projectId?: string,
) {
  const project = projectId
    ? await tx.project.findUniqueOrThrow({ where: { id: projectId } })
    : null;
  const members = await tx.membership.findMany({
    where: {
      workspaceId,
      ...(project?.restricted
        ? {
            OR: [
              { role: "owner" },
              { user: { projectMembers: { some: { projectId } } } },
            ],
          }
        : {}),
    },
    include: { user: true },
  });
  for (const member of members) {
    const n = await tx.notification.create({
      data: { workspaceId, userId: member.userId, title, text, href },
    });
    await tx.job.create({
      data: {
        key: "notification:" + n.id,
        kind: "email",
        payload: {
          to: member.user.email,
          subject: title,
          text: text + "\n" + appUrl() + href,
        },
      },
    });
  }
}
