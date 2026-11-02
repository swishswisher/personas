import { auth } from "@/server/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { emailReady } from "@/server/config";
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
  return handlers.POST(request);
}
