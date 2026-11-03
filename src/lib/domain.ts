import { z } from "zod";
// Leave room for multipart framing below Vercel's 4.5 MB request limit.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const roleSchema = z.enum(["owner", "editor", "viewer"]);
export type Role = z.infer<typeof roleSchema>;
export const classification = z.enum([
  "finding",
  "estimate",
  "hypothesis",
  "fictional",
]);
export const claimSchema = z.object({
  id: z.string().max(100),
  section: z.enum(["goal", "behaviour", "challenge", "need"]),
  text: z.string().trim().min(1).max(2000),
  classification,
  observationIds: z.array(z.string()).max(30),
  assumptions: z.string().max(2000).default(""),
});
export const personaContent = z.object({
  name: z.string().trim().min(2).max(100),
  subtitle: z.string().max(180).default(""),
  summary: z.string().max(4000),
  classification,
  claims: z.array(claimSchema).max(60),
});
export type PersonaContent = z.infer<typeof personaContent>;
export const plans = {
  free: {
    name: "Free",
    price: 0,
    seats: 1,
    projects: 2,
    personas: 5,
    ai: 0,
    storageMB: 100,
  },
  starter: {
    name: "Starter",
    price: 5,
    seats: 1,
    projects: 10,
    personas: 50,
    ai: 10,
    storageMB: 1024,
  },
  team: {
    name: "Team",
    price: 15,
    seats: 5,
    projects: 50,
    personas: 500,
    ai: 60,
    storageMB: 5120,
  },
  agency: {
    name: "Agency",
    price: 39,
    seats: 10,
    projects: 200,
    personas: 2000,
    ai: 200,
    storageMB: 20480,
  },
} as const;
export type Plan = keyof typeof plans;
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function ensure(
  value: unknown,
  status: number,
  code: string,
  message: string,
): asserts value {
  if (!value) throw new AppError(status, code, message);
}
export function canEdit(role: string) {
  return role === "owner" || role === "editor";
}
export function validateEvidence(
  content: PersonaContent,
  observations: { id: string; classification: string }[],
) {
  const byId = new Map(observations.map((o) => [o.id, o]));
  for (const claim of content.claims) {
    ensure(
      claim.observationIds.every((id) => byId.has(id)),
      422,
      "evidence_scope",
      "A citation is unavailable in this project.",
    );
    if (claim.classification === "finding")
      ensure(
        claim.observationIds.length > 0 &&
          claim.observationIds.every(
            (id) => byId.get(id)?.classification === "finding",
          ),
        422,
        "missing_evidence",
        "Every research finding needs a supporting research observation.",
      );
    if (claim.classification === "estimate")
      ensure(
        claim.assumptions.trim().length > 10,
        422,
        "missing_method",
        "Estimates need their assumptions and method.",
      );
  }
  if (content.classification === "finding")
    ensure(
      content.claims.length > 0 &&
        content.claims.every((c) => c.classification === "finding"),
      422,
      "mixed_evidence",
      "Use a hypothesis label until all claims are supported findings.",
    );
}
export function csvCell(value: unknown) {
  const s = String(value ?? "");
  return (
    '"' +
    (/^(?:\s*[=+\-@]|[\t\r])/.test(s) ? "'" + s : s).replaceAll('"', '""') +
    '"'
  );
}
export function snapshotCsv(content: PersonaContent, revision: number) {
  return [
    [
      "Persona",
      "Revision",
      "Classification",
      "Section",
      "Claim",
      "Evidence IDs",
      "Assumptions",
    ],
    ...[
      ["Overview", content.summary, content.classification, "", ""],
      ...content.claims.map((c) => [
        c.section,
        c.text,
        c.classification,
        c.observationIds.join(";"),
        c.assumptions,
      ]),
    ].map((r) => [content.name, revision, r[2], r[0], r[1], r[3], r[4]]),
  ]
    .map((r) => r.map(csvCell).join(","))
    .join("\r\n");
}
export function safeNext(value: string | null) {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : "/app";
}
