import { appUrl } from "./config";
import Stripe from "stripe";
import { db } from "./db";
import { workspaceAccess, type Actor } from "./security";
import { plans, type Plan, ensure } from "@/lib/domain";
import type { Subscription } from "@/generated/prisma/client";
export function effectivePlan(
  subscription: Pick<Subscription, "plan" | "status" | "periodEnd"> | null,
) {
  if (
    !subscription ||
    !["active", "trialing"].includes(subscription.status) ||
    (subscription.periodEnd && subscription.periodEnd < new Date())
  )
    return plans.free;
  return plans[subscription.plan as Plan] || plans.free;
}
export function stripe() {
  ensure(
    process.env.STRIPE_SECRET_KEY,
    503,
    "billing_unavailable",
    "Billing is not connected yet. No payment has been taken.",
  );
  return new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2 });
}
export async function checkout(
  actor: Actor,
  workspaceId: string,
  plan: Exclude<Plan, "free">,
) {
  const membership = await workspaceAccess(actor, workspaceId, "owner");
  ensure(
    !membership.workspace.demo,
    403,
    "demo_billing",
    "Demonstration workspaces cannot purchase subscriptions.",
  );
  const sub = membership.workspace.subscription;
  ensure(
    !sub?.providerId ||
      !["active", "trialing", "past_due"].includes(sub.status),
    409,
    "existing_subscription",
    "Manage the existing subscription in the billing portal.",
  );
  const price = process.env["STRIPE_PRICE_" + plan.toUpperCase()];
  ensure(
    price,
    503,
    "billing_unavailable",
    "This plan is not configured for checkout. No payment has been taken.",
  );
  const api = stripe();
  const session = await api.checkout.sessions.create(
    {
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      customer: sub?.customerId || undefined,
      customer_email: sub?.customerId ? undefined : actor.email,
      client_reference_id: workspaceId,
      metadata: { workspaceId },
      subscription_data: { metadata: { workspaceId, plan } },
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      success_url: `${appUrl()}/app/billing?workspace=${workspaceId}&checkout=pending`,
      cancel_url: `${appUrl()}/app/billing?workspace=${workspaceId}&checkout=cancelled`,
    },
    {
      idempotencyKey: `checkout:${workspaceId}:${plan}:${Math.floor(Date.now() / 300000)}`,
    },
  );
  return { url: session.url };
}
export async function billingPortal(actor: Actor, workspaceId: string) {
  const m = await workspaceAccess(actor, workspaceId, "owner");
  ensure(
    m.workspace.subscription?.customerId,
    409,
    "no_subscription",
    "This workspace has no billing customer yet.",
  );
  const session = await stripe().billingPortal.sessions.create({
    customer: m.workspace.subscription.customerId,
    return_url: `${appUrl()}/app/billing?workspace=${workspaceId}`,
  });
  return { url: session.url };
}
export async function invoices(actor: Actor, workspaceId: string) {
  const m = await workspaceAccess(actor, workspaceId, "owner");
  if (!m.workspace.subscription?.customerId) return [];
  const list = await stripe().invoices.list({
    customer: m.workspace.subscription.customerId,
    limit: 30,
  });
  return list.data.map((i) => ({
    id: i.id,
    number: i.number,
    status: i.status,
    amount: i.total,
    currency: i.currency,
    created: i.created,
    url: i.hosted_invoice_url,
    pdf: i.invoice_pdf,
  }));
}
export type CanonicalSubscription = {
  id: string;
  customer: string;
  workspaceId: string;
  plan: Plan;
  status: string;
  periodEnd: number;
  cancelAtEnd: boolean;
};
export function normalizeSubscription(
  s: Stripe.Subscription,
): CanonicalSubscription {
  const item = s.items.data[0];
  const price = item?.price.id;
  const plan = (Object.keys(plans) as Plan[]).find(
    (p) =>
      p !== "free" && process.env["STRIPE_PRICE_" + p.toUpperCase()] === price,
  );
  ensure(plan, 422, "unknown_price", "Subscription has an unrecognized price.");
  ensure(
    s.metadata.workspaceId,
    422,
    "missing_workspace",
    "Subscription workspace metadata is missing.",
  );
  return {
    id: s.id,
    customer: typeof s.customer === "string" ? s.customer : s.customer.id,
    workspaceId: s.metadata.workspaceId,
    plan,
    status: s.status,
    periodEnd: item?.current_period_end || 0,
    cancelAtEnd: s.cancel_at_period_end,
  };
}
export async function applyBillingState(
  eventId: string,
  created: number,
  state: CanonicalSubscription,
) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${state.workspaceId} FOR UPDATE`;
    const event = await tx.billingEvent.findUniqueOrThrow({
      where: { id: eventId },
    });
    if (event.status === "processed") return { duplicate: true };
    const workspace = await tx.workspace.findUnique({
      where: { id: state.workspaceId },
    });
    ensure(
      workspace && !workspace.demo,
      422,
      "invalid_workspace",
      "Billing workspace is unavailable.",
    );
    const current = await tx.subscription.findUnique({
      where: { workspaceId: state.workspaceId },
    });
    if (current && created < current.eventTime) {
      await tx.billingEvent.update({
        where: { id: eventId },
        data: {
          status: "processed",
          processedAt: new Date(),
          error: "Older event ignored",
        },
      });
      return { stale: true };
    }
    ensure(
      !current?.customerId || current.customerId === state.customer,
      422,
      "billing_identity",
      "Billing customer does not match workspace.",
    );
    const data = {
      providerId: state.id,
      customerId: state.customer,
      plan: state.plan,
      status: state.status,
      seats: plans[state.plan].seats,
      periodEnd: new Date(state.periodEnd * 1000),
      cancelAtEnd: state.cancelAtEnd,
      eventTime: created,
      eventId,
    };
    await tx.subscription.upsert({
      where: { workspaceId: state.workspaceId },
      create: { workspaceId: state.workspaceId, ...data },
      update: data,
    });
    await tx.billingEvent.update({
      where: { id: eventId },
      data: {
        workspaceId: state.workspaceId,
        status: "processed",
        error: null,
        processedAt: new Date(),
      },
    });
    await tx.auditEvent.create({
      data: {
        workspaceId: state.workspaceId,
        actorId: "billing-provider",
        action: "subscription.updated",
        targetId: state.id,
        detail: { eventId, status: state.status, plan: state.plan },
      },
    });
    return { processed: true };
  });
}
export async function processBillingEvent(eventId: string) {
  const event = await db.billingEvent.findUniqueOrThrow({
    where: { id: eventId },
  });
  if (event.status === "processed") return;
  const payload = event.payload as unknown as Stripe.Event;
  if (!payload.type.startsWith("customer.subscription.")) {
    await db.billingEvent.update({
      where: { id: eventId },
      data: { status: "processed", processedAt: new Date() },
    });
    return;
  }
  const original = payload.data.object as Stripe.Subscription;
  // Retrieve canonical state to handle delayed delivery; do not grant access from checkout redirects.
  const current = await stripe().subscriptions.retrieve(original.id);
  await applyBillingState(
    eventId,
    payload.created,
    normalizeSubscription(current),
  );
}
export async function receiveBillingEvent(raw: string, signature: string) {
  ensure(
    process.env.STRIPE_WEBHOOK_SECRET,
    503,
    "webhook_config",
    "Webhook is not configured.",
  );
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      raw,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    throw new Error("Invalid billing signature");
  }
  await db.$transaction(async (tx) => {
    await tx.billingEvent.upsert({
      where: { id: event.id },
      create: { id: event.id, type: event.type, payload: JSON.parse(raw) },
      update: {},
    });
    await tx.job.upsert({
      where: { key: "billing:" + event.id },
      create: {
        key: "billing:" + event.id,
        kind: "billing",
        payload: { eventId: event.id },
      },
      update: {},
    });
  });
  return { received: true };
}
