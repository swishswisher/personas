import { z } from "zod";
import { db } from "./db";
import { staffAccess, type Actor } from "./security";
import { ensure } from "@/lib/domain";
export async function adminData(actor: Actor) {
  const role = await staffAccess(actor);
  const [workspaces, support, enquiries, content, audit, jobs, billing] =
    await Promise.all([
      db.workspace.findMany({
        select: {
          id: true,
          name: true,
          demo: true,
          createdAt: true,
          subscription: { select: { plan: true, status: true } },
          _count: { select: { memberships: true, projects: true } },
        },
        take: 100,
        orderBy: { createdAt: "desc" },
      }),
      db.supportRequest.findMany({ take: 100, orderBy: { createdAt: "desc" } }),
      db.enquiry.findMany({ take: 100, orderBy: { createdAt: "desc" } }),
      db.contentRevision.findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
      }),
      db.auditEvent.findMany({ take: 100, orderBy: { createdAt: "desc" } }),
      db.job.findMany({
        select: {
          id: true,
          kind: true,
          status: true,
          attempts: true,
          error: true,
          createdAt: true,
        },
        where: { status: { not: "complete" } },
        take: 100,
        orderBy: { createdAt: "desc" },
      }),
      db.billingEvent.findMany({
        select: {
          id: true,
          workspaceId: true,
          type: true,
          status: true,
          error: true,
          createdAt: true,
        },
        take: 100,
        orderBy: { createdAt: "desc" },
      }),
    ]);
  return {
    role,
    workspaces,
    support,
    enquiries,
    content,
    audit,
    jobs,
    billing,
  };
}
const input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("content.unpublish"),
    slug: z
      .string()
      .regex(/^[a-z0-9/-]+$/)
      .max(100),
    reason: z.string().trim().min(10).max(500),
  }),
  z.object({
    action: z.literal("support.reply"),
    id: z.string(),
    text: z.string().trim().min(1).max(6000),
    status: z.enum(["open", "pending", "resolved"]),
    reason: z.string().trim().min(10).max(500),
  }),
  z.object({
    action: z.literal("content.save"),
    slug: z
      .string()
      .regex(/^[a-z0-9/-]+$/)
      .max(100),
    title: z.string().min(2).max(150),
    body: z.string().min(10).max(30000),
    published: z.boolean(),
    reason: z.string().trim().min(10).max(500),
  }),
  z.object({
    action: z.literal("enquiry.status"),
    id: z.string(),
    status: z.enum(["new", "in_progress", "closed"]),
    reason: z.string().trim().min(10).max(500),
  }),
  z.object({
    action: z.literal("job.retry"),
    id: z.string(),
    reason: z.string().trim().min(10).max(500),
  }),
]);
export async function adminCommand(actor: Actor, raw: unknown) {
  const role = await staffAccess(actor),
    c = input.parse(raw);
  if (
    c.action === "content.save" ||
    c.action === "content.unpublish" ||
    c.action === "job.retry"
  )
    ensure(
      role === "admin",
      403,
      "staff_permission",
      "An administrator must perform this action.",
    );
  return db.$transaction(async (tx) => {
    if (c.action === "support.reply") {
      const req = await tx.supportRequest.findUniqueOrThrow({
        where: { id: c.id },
      });
      const replies = Array.isArray(req.replies) ? req.replies : [];
      await tx.supportRequest.update({
        where: { id: c.id },
        data: {
          status: c.status,
          replies: [
            ...replies,
            {
              text: c.text,
              author: actor.name,
              createdAt: new Date().toISOString(),
            },
          ],
        },
      });
      await tx.job.create({
        data: {
          key: "support:" + crypto.randomUUID(),
          kind: "email",
          payload: {
            to: req.email,
            subject: "Re: " + req.subject,
            text: c.text,
          },
        },
      });
      await tx.notification.create({
        data: {
          userId: req.userId,
          workspaceId: req.workspaceId,
          title: "Support replied",
          text: c.text,
          href: "/app/support",
        },
      });
    } else if (c.action === "content.unpublish")
      await tx.contentRevision.updateMany({
        where: { slug: c.slug, published: true },
        data: { published: false },
      });
    else if (c.action === "content.save")
      await tx.contentRevision.create({
        data: {
          slug: c.slug,
          title: c.title,
          body: c.body,
          published: c.published,
          authorId: actor.id,
        },
      });
    else if (c.action === "enquiry.status")
      await tx.enquiry.update({
        where: { id: c.id },
        data: { status: c.status },
      });
    else if (c.action === "job.retry") {
      const job = await tx.job.findUniqueOrThrow({ where: { id: c.id } });
      ensure(
        job.status !== "processing",
        409,
        "job_busy",
        "A worker is processing this job.",
      );
      await tx.job.update({
        where: { id: c.id },
        data: {
          status: "queued",
          attempts: 0,
          availableAt: new Date(),
          error: null,
        },
      });
    }
    await tx.auditEvent.create({
      data: {
        actorId: actor.id,
        action: "staff." + c.action,
        targetId: "id" in c ? c.id : c.slug,
        detail: { reason: c.reason },
      },
    });
    return { ok: true };
  });
}
