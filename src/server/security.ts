import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { db } from "./db";
import { AppError, ensure, canEdit } from "@/lib/domain";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export function hashPassphrase(value: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(value, salt, 32).toString("hex");
}
export function checkPassphrase(value: string, encoded: string) {
  const [salt, hash] = encoded.split(":");
  if (!salt || !hash) return false;
  const a = scryptSync(value, salt, 32),
    b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
export type Actor = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
};
export async function workspaceAccess(
  actor: Actor,
  workspaceId: string,
  minimum: "viewer" | "editor" | "owner" = "viewer",
) {
  const membership = await db.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: actor.id } },
    include: { workspace: { include: { subscription: true } } },
  });
  ensure(membership, 404, "not_found", "Workspace is unavailable.");
  ensure(
    minimum === "viewer" ||
      (minimum === "editor" && canEdit(membership.role)) ||
      membership.role === "owner",
    403,
    "permission",
    "Your role does not permit this action.",
  );
  return membership;
}
export async function projectAccess(
  actor: Actor,
  workspaceId: string,
  projectId: string,
  minimum: "viewer" | "editor" | "owner" = "viewer",
  research = false,
  exportOnly = false,
) {
  const membership = await workspaceAccess(actor, workspaceId, minimum);
  const subscription = membership.workspace.subscription;
  if (
    subscription?.providerId &&
    ((subscription.periodEnd && subscription.periodEnd < new Date()) ||
      !["active", "trialing"].includes(subscription.status))
  ) {
    const end = subscription.periodEnd?.getTime() || 0;
    ensure(
      Date.now() < end + 30 * 86400000,
      402,
      "subscription_expired",
      "The export window has ended. Renew the workspace subscription or contact support.",
    );
    ensure(
      minimum === "viewer" || exportOnly,
      402,
      "workspace_readonly",
      "This workspace is read-only after its paid subscription. You can export approved work during the 30-day export window.",
    );
  }
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      workspaceId,
      archived: false,
      ...(membership.role === "owner"
        ? {}
        : {
            OR: [
              { restricted: false },
              { members: { some: { userId: actor.id } } },
            ],
          }),
    },
  });
  ensure(project, 404, "not_found", "Project is unavailable.");
  ensure(
    !research || membership.role !== "viewer" || project.viewerResearch,
    403,
    "research_permission",
    "Research is private to the project research team.",
  );
  return { membership, project };
}
export async function staffAccess(actor: Actor) {
  const user = await db.user.findUnique({
    where: { id: actor.id },
    select: { staffRole: true },
  });
  ensure(
    user?.staffRole === "admin" || user?.staffRole === "support",
    403,
    "staff_permission",
    "Staff access is required.",
  );
  return user.staffRole;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.APP_URL || request.url).origin;
  ensure(
    origin === expected,
    403,
    "origin",
    "This request must come from the application.",
  );
}
export async function rateLimit(key: string, limit = 60, seconds = 60) {
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const scoped = `app:${key}:${bucket}`;
  const rows = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateLimit" (id,key,count,"lastRequest") VALUES (${scoped},${scoped},1,${BigInt(Date.now())}) ON CONFLICT (key) DO UPDATE SET count="RateLimit".count+1 RETURNING count`;
  if (rows[0].count > limit)
    throw new AppError(
      429,
      "rate_limit",
      "Please wait a moment before trying again.",
    );
}
export function log(event: string, detail: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({ time: new Date().toISOString(), event, ...detail }),
  );
}
