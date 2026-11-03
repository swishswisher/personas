import { db } from "@/server/db";
export const dynamic = "force-dynamic";
export const maxDuration = 15;
export async function GET() {
  let ready = false;
  try {
    await db.user.count();
    if (process.env.FILE_STORAGE === "database") await db.privateObject.count();
    ready = (process.env.BETTER_AUTH_SECRET?.length || 0) >= 32;
  } catch {
    /* Do not expose database/provider errors or connection strings. */
  }
  return Response.json(
    { status: ready ? "ready" : "not_ready" },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
