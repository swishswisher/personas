import { receiveBillingEvent } from "@/server/subscriptions";
import { log } from "@/server/security";
export async function POST(request: Request) {
  try {
    return Response.json(
      await receiveBillingEvent(
        await request.text(),
        request.headers.get("stripe-signature") || "",
      ),
    );
  } catch {
    log("billing.webhook.rejected");
    return Response.json(
      { error: "Webhook signature or configuration is invalid." },
      { status: 400 },
    );
  }
}
