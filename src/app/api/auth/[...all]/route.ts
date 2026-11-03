import { auth } from "@/server/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { emailReady } from "@/server/config";
import { scheduleJobs } from "@/server/job-wakeup";
export const maxDuration = 90;
const handlers = toNextJsHandler(auth);
export const GET = handlers.GET;
export async function POST(request: Request) {
  if (
    /\/(sign-up\/email|request-password-reset|send-verification-email)$/.test(
      new URL(request.url).pathname,
    ) &&
    !emailReady()
  )
    return Response.json(
      {
        code: "EMAIL_UNAVAILABLE",
        message:
          "Account email delivery is not configured. Please contact support.",
      },
      { status: 503 },
    );
  const response = await handlers.POST(request);
  if (response.ok) scheduleJobs();
  return response;
}
