import { receiveBillingEvent } from "@/server/subscriptions";
import { log } from "@/server/security";
import { scheduleJobs } from "@/server/job-wakeup";
export const maxDuration = 90;
export async function POST(request: Request) {
  try {
    const response = Response.json(
      await receiveBillingEvent(
        await request.text(),
        request.headers.get("stripe-signature") || "",
      ),
    );
    scheduleJobs();
    return response;
  } catch {
    log("billing.webhook.rejected");
    return Response.json(
      { error: "Webhook signature or configuration is invalid." },
      { status: 400 },
    );
  }
}
