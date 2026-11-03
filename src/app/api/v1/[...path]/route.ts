import { reserveSourceCapacity } from "@/server/quotas";
import { readJson } from "@/server/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requestActor } from "@/server/auth";
import { ensure, AppError, MAX_UPLOAD_BYTES } from "@/lib/domain";
import { scheduleJobs } from "@/server/job-wakeup";
import {
  sameOrigin,
  rateLimit,
  projectAccess,
  newToken,
  hashToken,
  log,
} from "@/server/security";
import { command } from "@/server/commands";
import { workspaceData, sourceDetail, personaHistory } from "@/server/queries";
import { acceptInvitation } from "@/server/team";
import { readShare } from "@/server/publishing";
import { putFile, getFile } from "@/server/storage";
import { adminData, adminCommand } from "@/server/admin";
import { invoices } from "@/server/subscriptions";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  const requestId = crypto.randomUUID();
  try {
    const { path } = await context.params,
      url = new URL(request.url),
      post = request.method === "POST";
    if (post) sameOrigin(request);
    const actor = await requestActor(request);
    if (path[0] === "enquiries" && post) {
      await rateLimit(
        "contact:" +
          hashToken(request.headers.get("x-forwarded-for") || "unknown"),
        5,
        3600,
      );
      const data = z
        .object({
          name: z.string().trim().min(2).max(100),
          email: z.email(),
          company: z.string().max(200).optional(),
          text: z.string().trim().min(10).max(6000),
          website: z.string().max(0).optional(),
        })
        .parse(await readJson(request));
      const enquiry = await db.enquiry.create({
        data: {
          name: data.name,
          email: data.email,
          company: data.company,
          text: data.text,
        },
      });
      return json({
        id: enquiry.id,
        message: "Your enquiry is saved. Our team will reply by email.",
      });
    }
    if (path[0] === "share") {
      await rateLimit(
        "share:" +
          hashToken(request.headers.get("x-forwarded-for") || "unknown"),
        30,
      );
      const passphrase = post
        ? z
            .object({ passphrase: z.string().max(128) })
            .parse(await readJson(request)).passphrase
        : undefined;
      return json(await readShare(path[1], actor, passphrase));
    }
    ensure(
      actor,
      401,
      "session_expired",
      "Sign in with a verified account to continue.",
    );
    // Reading the workspace must not consume the separate mutation allowance.
    await rateLimit(`${post ? "write" : "read"}:${actor.id}`, post ? 90 : 180);
    if (path[0] === "me")
      return json({
        user: { id: actor.id, name: actor.name, email: actor.email },
        workspaces: await db.membership.findMany({
          where: { userId: actor.id },
          select: {
            role: true,
            workspace: { select: { id: true, name: true, demo: true } },
          },
        }),
      });
    if (path[0] === "onboarding" && post) {
      const c = z
        .object({
          workspaceName: z.string().trim().min(2).max(100),
          projectName: z.string().trim().min(2).max(100),
        })
        .parse(await readJson(request));
      ensure(
        (await db.membership.count({
          where: { userId: actor.id, role: "owner" },
        })) < 10,
        422,
        "workspace_limit",
        "You can own up to 10 workspaces.",
      );
      const workspace = await db.$transaction(async (tx) => {
        const ws = await tx.workspace.create({
          data: {
            name: c.workspaceName,
            memberships: { create: { userId: actor.id, role: "owner" } },
            subscription: { create: {} },
            projects: {
              create: {
                name: c.projectName,
                members: { create: { userId: actor.id } },
              },
            },
          },
        });
        await tx.auditEvent.create({
          data: {
            workspaceId: ws.id,
            actorId: actor.id,
            action: "workspace.created",
            targetId: ws.id,
          },
        });
        return ws;
      });
      return json({ workspaceId: workspace.id });
    }
    if (path[0] === "invitations" && path[1] === "accept" && post) {
      const { token } = z
        .object({ token: z.string().min(20).max(200) })
        .parse(await readJson(request));
      return json(await acceptInvitation(actor, token));
    }
    if (path[0] === "admin")
      return json(
        post
          ? await adminCommand(actor, await readJson(request))
          : await adminData(actor),
      );
    ensure(
      path[0] === "workspaces" && path[1],
      404,
      "not_found",
      "Endpoint not found.",
    );
    const workspaceId = path[1];
    if (path[2] === "data" && !post)
      return json(
        await workspaceData(
          actor,
          workspaceId,
          url.searchParams.get("project") || undefined,
          (url.searchParams.get("q") || "").slice(0, 200),
          {
            page: Number(url.searchParams.get("page") || 1),
            personaId: url.searchParams.get("personaId") || undefined,
            sourceId: url.searchParams.get("sourceId") || undefined,
            kind: url.searchParams.get("kind") || undefined,
            status: url.searchParams.get("status") || undefined,
          },
        ),
      );
    if (path[2] === "commands" && post)
      return json(await command(actor, workspaceId, await readJson(request)));
    if (path[2] === "sources" && path[3] && !post && path.length === 4)
      return json(await sourceDetail(actor, workspaceId, path[3]));
    if (path[2] === "personas" && path[3] && !post)
      return json(await personaHistory(actor, workspaceId, path[3]));
    if (path[2] === "invoices" && !post)
      return json(await invoices(actor, workspaceId));
    if (path[2] === "upload" && post) {
      ensure(
        Number(request.headers.get("content-length") || 0) <=
          MAX_UPLOAD_BYTES + 256 * 1024,
        413,
        "upload_size",
        "Upload a file smaller than 4 MB.",
      );
      const data = await request.formData();
      const projectId = z.string().min(1).parse(data.get("projectId"));
      await projectAccess(actor, workspaceId, projectId, "editor", true);
      const file = data.get("file");
      ensure(
        file instanceof File && file.size > 0 && file.size <= MAX_UPLOAD_BYTES,
        413,
        "upload_size",
        "Upload a file between 1 byte and 4 MB.",
      );
      const ext = file.name.split(".").pop()?.toLowerCase();
      const mime =
        ext === "pdf"
          ? "application/pdf"
          : ext === "csv"
            ? "text/csv"
            : ["txt", "md"].includes(ext || "")
              ? "text/plain"
              : null;
      ensure(
        mime,
        422,
        "upload_type",
        "Choose a PDF, TXT, MD, or CSV research file.",
      );
      const bytes = Buffer.from(await file.arrayBuffer());
      if (mime === "application/pdf")
        ensure(
          bytes.subarray(0, 5).toString() === "%PDF-",
          422,
          "file_mismatch",
          "This file is not a valid PDF.",
        );
      else
        ensure(
          !bytes.includes(0),
          422,
          "file_mismatch",
          "Text uploads must be UTF-8 text.",
        );
      const fileKey = `research/${workspaceId}/${newToken()}`;
      await putFile(fileKey, bytes, mime);
      const source = await db
        .$transaction(async (tx) => {
          await reserveSourceCapacity(tx, workspaceId, file.size);
          const s = await tx.researchSource.create({
            data: {
              workspaceId,
              projectId,
              title: file.name.slice(0, 200),
              kind: "upload",
              tags: [],
              fileKey,
              fileName: file.name.slice(0, 200),
              mime,
              bytes: file.size,
              status: "processing",
            },
          });
          await tx.job.create({
            data: {
              key: "extract:" + s.id,
              kind: "extract",
              payload: { sourceId: s.id },
            },
          });
          await tx.auditEvent.create({
            data: {
              workspaceId,
              actorId: actor.id,
              action: "source.uploaded",
              targetId: s.id,
            },
          });
          return s;
        })
        .catch(async (error) => {
          await db.job.upsert({
            where: { key: "delete:" + fileKey },
            create: {
              key: "delete:" + fileKey,
              kind: "delete_file",
              payload: { fileKey },
            },
            update: {},
          });
          throw error;
        });
      return json({ id: source.id });
    }
    if (path[2] === "files" && path[3] && !post) {
      const source = await db.researchSource.findFirst({
        where: { id: path[3], workspaceId, deletedAt: null, status: "ready" },
      });
      ensure(source?.fileKey, 404, "not_found", "File is unavailable.");
      await projectAccess(actor, workspaceId, source.projectId, "viewer", true);
      return new Response(new Uint8Array(await getFile(source.fileKey)), {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${(source.fileName || "research").replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (path[2] === "exports" && path[3] && !post) {
      const exp = await db.exportJob.findFirst({
        where: {
          id: path[3],
          requestedBy: actor.id,
          snapshot: { workspaceId },
        },
        include: { snapshot: true },
      });
      ensure(
        exp?.status === "ready" && exp.fileKey && exp.expiresAt > new Date(),
        410,
        "export_unavailable",
        "This export is not ready or has expired.",
      );
      await projectAccess(
        actor,
        workspaceId,
        exp.snapshot.projectId,
        "editor",
        false,
        true,
      );
      return new Response(new Uint8Array(await getFile(exp.fileKey)), {
        headers: {
          "Content-Type":
            exp.format === "pdf"
              ? "application/pdf"
              : "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="personas-${exp.id}.${exp.format}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    throw new AppError(404, "not_found", "Endpoint not found.");
  } catch (error) {
    if (error instanceof z.ZodError)
      return json(
        {
          error: "Check the form fields and try again.",
          code: "validation",
          fields: error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
          requestId,
        },
        422,
      );
    if (error instanceof AppError)
      return json(
        { error: error.message, code: error.code, requestId },
        error.status,
      );
    log("request.failed", {
      requestId,
      type: error instanceof Error ? error.constructor.name : "unknown",
    });
    return json(
      {
        error:
          "Something went wrong. Your previous saved work is safe. Try again or contact support.",
        code: "server_error",
        requestId,
      },
      500,
    );
  }
}
function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
export const GET = handle;
export async function POST(request: Request, context: Context) {
  const response = await handle(request, context);
  if (response.ok) scheduleJobs();
  return response;
}
