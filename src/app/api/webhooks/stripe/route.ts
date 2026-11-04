import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { claimEvent, recordContributionSucceeded } from "@/lib/payments/ledger";
import { stripe } from "@/lib/payments/stripe";

/**
 * Stripe webhook. Signature verified against the raw body (constructEvent also
 * enforces a 5-minute timestamp tolerance), then de-duplicated by event id.
 */
export async function POST(req: NextRequest) {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (env().PAYMENTS_MODE !== "stripe" || !secret) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, req.headers.get("stripe-signature") ?? "", secret, 300);
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }
  if (!(await claimEvent(event.id, "stripe"))) return NextResponse.json({ ok: true, duplicate: true });

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    const contributionId = session.metadata?.contributionId;
    if (contributionId && session.payment_status === "paid") {
      const pi = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
      await recordContributionSucceeded(contributionId, pi);
    }
  } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    const contributionId = event.data.object.metadata?.contributionId;
    if (contributionId) await db().update(schema.contributions).set({ status: "failed" }).where(eq(schema.contributions.id, contributionId));
  }
  return NextResponse.json({ ok: true });
}
