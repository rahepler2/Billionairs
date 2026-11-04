import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";
import { THREE_DS_OVER_CENTS } from "@/lib/validation";
import type { FeeBreakdown } from "@/lib/fees";

let client: Stripe | undefined;
export function stripe(): Stripe {
  const key = env().STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured");
  // Use a restricted key scoped to Checkout + Connect in production.
  return (client ??= new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000 }));
}

/**
 * Stripe Checkout with Connect destination charges. Card data goes straight
 * to Stripe (PCI SAQ-A). The bill amount is transferred to the bill-pay
 * partner's connected account; the platform fee + processing stays with Lifted.
 */
export async function createCheckoutSession(opts: {
  contributionId: string;
  billId: string;
  billerName: string;
  fees: FeeBreakdown;
  customerEmail?: string;
}) {
  const { APP_URL, STRIPE_BILLPAY_PARTNER_ACCOUNT } = env();
  const { fees } = opts;
  return stripe().checkout.sessions.create(
    {
      mode: "payment",
      client_reference_id: opts.contributionId,
      metadata: { contributionId: opts.contributionId, billId: opts.billId },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: fees.amountCents,
            product_data: { name: `Lift: ${opts.billerName} bill`, description: "Paid directly to the biller. Not tax-deductible." },
          },
        },
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: fees.platformFeeCents + fees.processingFeeCents,
            product_data: { name: "Platform + processing fee", description: "Keeps 100% of your Lift going to the bill." },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: fees.platformFeeCents + fees.processingFeeCents,
        transfer_data: { destination: STRIPE_BILLPAY_PARTNER_ACCOUNT! },
        metadata: { contributionId: opts.contributionId, billId: opts.billId },
      },
      payment_method_options: fees.totalCents > THREE_DS_OVER_CENTS ? { card: { request_three_d_secure: "any" } } : undefined,
      success_url: `${APP_URL}/bills/${opts.billId}?lifted=1`,
      cancel_url: `${APP_URL}/bills/${opts.billId}`,
    },
    { idempotencyKey: `checkout:${opts.contributionId}` },
  );
}

export async function refundContribution(paymentIntentId: string, contributionId: string) {
  return stripe().refunds.create(
    { payment_intent: paymentIntentId, reverse_transfer: true, refund_application_fee: true },
    { idempotencyKey: `refund:${contributionId}` },
  );
}
