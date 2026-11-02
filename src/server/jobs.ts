import { localEmailCapture } from "./config";
import { db } from "./db";
import { getFile, putFile, scanFile, deleteFile } from "./storage";
import { processBillingEvent } from "./subscriptions";
import { personaContent, snapshotCsv, ensure } from "@/lib/domain";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { PDFDocument, rgb } from "pdf-lib";
import { randomUUID } from "node:crypto";
import { log } from "./security";
import { mkdir, writeFile } from "node:fs/promises";
export async function renderPdf(
  content: ReturnType<typeof personaContent.parse>,
  revision: number,
) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontBytes = await readFile(
    process.cwd() + "/public/fonts/Ubuntu-R.ttf",
  );
  const font = await pdf.embedFont(fontBytes, { subset: true }),
    bold = font;
  let page = pdf.addPage([595, 842]),
    y = 790;
  const line = (text: string, size = 11, heading = false) => {
    const safe = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ");
    const words = safe.split(/\s+/);
    let row = "";
    for (const word of words) {
      if (font.widthOfTextAtSize(row + " " + word, size) > 490 && row) {
        draw(row);
        row = word;
      } else row += (row ? " " : "") + word;
    }
    if (row) draw(row);
    y -= 8;
    function draw(t: string) {
      if (y < 65) {
        page = pdf.addPage([595, 842]);
        y = 790;
      }
      page.drawText(t, {
        x: 50,
        y,
        size,
        font: heading ? bold : font,
        color: rgb(0.21, 0.19, 0.27),
      });
      y -= size * 1.5;
    }
  };
  line("personas. / Approved audience snapshot", 13, true);
  line(content.name, 26, true);
  line(`Revision ${revision} | ${content.classification}`, 10);
  line(content.subtitle, 13);
  line(content.summary, 12);
  for (const claim of content.claims) {
    line(`${claim.section.toUpperCase()} / ${claim.classification}`, 10, true);
    line(claim.text);
    if (claim.observationIds.length)
      line("Evidence: " + claim.observationIds.join(", "), 9);
    if (claim.assumptions)
      line("Method / assumptions: " + claim.assumptions, 9);
  }
  line(
    "Qualitative findings apply to the supplied sample. Downloaded files cannot be revoked.",
    9,
  );
  return Buffer.from(await pdf.save());
}
async function deliverMail(payload: Record<string, unknown>, key: string) {
  const to = String(payload.to),
    subject = String(payload.subject),
    text = String(payload.text);
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [to],
        subject,
        text,
      }),
      signal: AbortSignal.timeout(20000),
    });
    ensure(
      response.ok,
      503,
      "email_delivery",
      "Email provider rejected delivery.",
    );
  } else if (localEmailCapture()) {
    await mkdir(".data/mail", { recursive: true, mode: 0o700 });
    await writeFile(
      `.data/mail/${key.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`,
      JSON.stringify({ to, subject, text }),
      { mode: 0o600 },
    );
  } else throw new Error("Transactional email is not configured");
}
async function extractSource(sourceId: string) {
  const source = await db.researchSource.findUniqueOrThrow({
    where: { id: sourceId },
  });
  if (source.deletedAt) return;
  ensure(source.fileKey, 422, "no_file", "No source file is available.");
  const body = await getFile(source.fileKey);
  await scanFile(body, source.mime || "application/octet-stream");
  let text: string;
  if (source.mime === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({
      data: new Uint8Array(body),
      isEvalSupported: false,
    });
    try {
      text = (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  } else text = new TextDecoder("utf-8", { fatal: true }).decode(body);
  ensure(
    text.trim().length > 0 && text.length <= 250000,
    422,
    "extraction_size",
    "No usable text was found, or the file exceeds 250,000 characters. Paste a shorter excerpt.",
  );
  await db.researchSource.updateMany({
    where: { id: sourceId, deletedAt: null, fileKey: source.fileKey },
    data: { text, status: "ready", failure: null },
  });
}
export async function runJobs(limit = 10) {
  await db.job.updateMany({
    where: {
      status: "processing",
      lockedAt: { lt: new Date(Date.now() - 600000) },
      attempts: { gte: 5 },
    },
    data: { status: "dead", error: "Worker lease expired after final attempt" },
  });
  await db.rateLimit.deleteMany({
    where: { lastRequest: { lt: BigInt(Date.now() - 86400000) } },
  });
  await db.job.updateMany({
    where: {
      kind: "email",
      status: "complete",
      completedAt: { lt: new Date(Date.now() - 7 * 86400000) },
    },
    data: { payload: { redacted: true } },
  });
  let completed = 0;
  for (let i = 0; i < limit; i++) {
    const lock = randomUUID();
    const rows = await db.$queryRaw<
      { id: string }[]
    >`UPDATE "Job" SET status='processing',"lockedAt"=NOW(),"lockToken"=${lock},attempts=attempts+1 WHERE id=(SELECT id FROM "Job" WHERE ((status IN ('queued','retry') AND "availableAt"<=NOW()) OR (status='processing' AND "lockedAt"<NOW()-INTERVAL '10 minutes')) AND attempts<5 ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id`;
    if (!rows.length) break;
    const job = await db.job.findUniqueOrThrow({ where: { id: rows[0].id } });
    const p = job.payload as Record<string, unknown>;
    try {
      if (job.kind === "delete_file") await deleteFile(String(p.fileKey));
      else if (job.kind === "email") await deliverMail(p, job.key);
      else if (job.kind === "billing")
        await processBillingEvent(String(p.eventId));
      else if (job.kind === "extract") await extractSource(String(p.sourceId));
      else if (job.kind === "export") {
        const exp = await db.exportJob.findUniqueOrThrow({
          where: { id: String(p.exportId) },
          include: {
            snapshot: {
              include: { approval: { include: { revision: true } } },
            },
          },
        });
        const content = personaContent.parse(exp.snapshot.content),
          revision = exp.snapshot.approval.revision.number;
        const body =
          exp.format === "pdf"
            ? await renderPdf(content, revision)
            : Buffer.from(snapshotCsv(content, revision));
        const key = `exports/${exp.id}.${exp.format}`;
        await putFile(
          key,
          body,
          exp.format === "pdf" ? "application/pdf" : "text/csv",
        );
        const ready = await db.exportJob.updateMany({
          where: { id: exp.id, status: { in: ["queued", "failed"] } },
          data: { status: "ready", fileKey: key, failure: null },
        });
        if (!ready.count) await deleteFile(key);
      } else throw new Error("Unknown job kind");
      await db.job.updateMany({
        where: { id: job.id, lockToken: lock },
        data: { status: "complete", completedAt: new Date(), error: null },
      });
      completed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Job failed";
      await db.job.updateMany({
        where: { id: job.id, lockToken: lock },
        data: {
          status: job.attempts >= 5 ? "dead" : "retry",
          error: message.slice(0, 300),
          availableAt: new Date(
            Date.now() + Math.min(3600000, 2 ** job.attempts * 30000),
          ),
        },
      });
      if (job.kind === "extract")
        await db.researchSource.updateMany({
          where: { id: String(p.sourceId) },
          data: { status: "failed", failure: message.slice(0, 300) },
        });
      if (job.kind === "export")
        await db.exportJob.updateMany({
          where: { id: String(p.exportId) },
          data: { status: "failed", failure: message.slice(0, 300) },
        });
      if (job.kind === "billing")
        await db.billingEvent.updateMany({
          where: { id: String(p.eventId) },
          data: { status: "failed", error: message.slice(0, 300) },
        });
      log("job.failed", {
        jobId: job.id,
        kind: job.kind,
        attempt: job.attempts,
      });
    }
  }
  return { completed };
}
