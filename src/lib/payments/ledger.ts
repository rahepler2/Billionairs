import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/security/audit";
import { detokenizeForPayout, schedulePurge } from "@/lib/security/vault";
import { billPayPartner } from "./billpay";
import { refundContribution } from "./stripe";

/** Record a webhook event id exactly once. Returns false if it was already processed (replay). */
export async function claimEvent(id: string, source: "stripe" | "billpay"): Promise<boolean> {
  const rows = await db().insert(schema.processedEvents).values({ id, source }).onConflictDoNothing().returning({ id: schema.processedEvents.id });
  return rows.length === 1;
}

/**
 * A donor's payment cleared. Atomically adds it to the bill. If it completes
 * the bill, the payout to the biller is submitted to the bill-pay partner.
 * A payment that would over-fund the bill is refunded in full.
 */
export async function recordContributionSucceeded(contributionId: string, paymentIntentId: string | null) {
  const outcome = await db().transaction(async (tx) => {
    const [c] = await tx
      .update(schema.contributions)
      .set({ status: "succeeded", succeededAt: new Date(), stripePaymentIntentId: paymentIntentId })
      .where(and(eq(schema.contributions.id, contributionId), eq(schema.contributions.status, "pending")))
      .returning();
    if (!c) return { kind: "noop" as const };

    // Lock the bill row so concurrent payments can't both "complete" it.
    const [bill] = await tx.select().from(schema.bills).where(eq(schema.bills.id, c.billId)).for("update");
    if (!bill) throw new Error("bill missing");
    const remaining = bill.amountCents - bill.fundedCents;
    if (bill.status !== "live" || c.amountCents > remaining) {
      await tx.update(schema.contributions).set({ status: "refunded" }).where(eq(schema.contributions.id, c.id));
      return { kind: "overfund" as const, contribution: c };
    }
    const fundedCents = bill.fundedCents + c.amountCents;
    const complete = fundedCents >= bill.amountCents;
    await tx
      .update(schema.bills)
      .set({ fundedCents, status: complete ? "funded" : "live" })
      .where(eq(schema.bills.id, bill.id));
    return { kind: complete ? ("complete" as const) : ("partial" as const), contribution: c };
  });

  if (outcome.kind === "noop") return outcome.kind;
  const c = outcome.contribution;
  if (outcome.kind === "overfund") {
    if (env().PAYMENTS_MODE === "stripe" && paymentIntentId) await refundContribution(paymentIntentId, c.id);
    await audit("contribution.refunded_overfund", { actorId: c.donorId, target: c.billId, meta: { contributionId: c.id } });
    return outcome.kind;
  }
  await audit("contribution.succeeded", { actorId: c.donorId, target: c.billId, meta: { contributionId: c.id, amountCents: c.amountCents } });
  if (outcome.kind === "complete") await submitPayout(c.billId);
  return outcome.kind;
}

export async function submitPayout(billId: string) {
  const [bill] = await db()
    .select({ bill: schema.bills, partnerBillerId: schema.billers.partnerBillerId })
    .from(schema.bills)
    .leftJoin(schema.billers, eq(schema.billers.id, schema.bills.billerId))
    .where(eq(schema.bills.id, billId));
  if (!bill || bill.bill.status !== "funded") return;

  const accountNumber = await detokenizeForPayout(bill.bill.accountToken);
  const { partnerRef } = await billPayPartner().submitPayment({
    billId,
    billerName: bill.bill.billerName,
    partnerBillerId: bill.partnerBillerId,
    accountNumber,
    amountCents: bill.bill.amountCents,
  });
  await db().insert(schema.payouts).values({ billId, partnerRef, amountCents: bill.bill.amountCents }).onConflictDoNothing();
  await audit("payout.submitted", { target: billId, meta: { partnerRef } });

  // The mock partner confirms instantly; a real partner calls /api/webhooks/billpay.
  if (env().PAYMENTS_MODE === "mock") await confirmPayout(partnerRef);
}

export async function confirmPayout(partnerRef: string) {
  const [payout] = await db()
    .update(schema.payouts)
    .set({ status: "confirmed", resolvedAt: new Date() })
    .where(and(eq(schema.payouts.partnerRef, partnerRef), eq(schema.payouts.status, "submitted")))
    .returning();
  if (!payout) return;
  const [bill] = await db()
    .update(schema.bills)
    .set({ status: "paid", paidAt: new Date() })
    .where(eq(schema.bills.id, payout.billId))
    .returning({ accountToken: schema.bills.accountToken });
  // Retention: destroy the account number 90 days after payment.
  if (bill) await schedulePurge(bill.accountToken, new Date(Date.now() + 90 * 86_400_000));
  await audit("payout.confirmed", { target: payout.billId, meta: { partnerRef } });
}

/** Biller rejected the payment: every donor is refunded in full, including the fee. */
export async function rejectPayout(partnerRef: string, reason: string) {
  const [payout] = await db()
    .update(schema.payouts)
    .set({ status: "rejected", resolvedAt: new Date() })
    .where(and(eq(schema.payouts.partnerRef, partnerRef), eq(schema.payouts.status, "submitted")))
    .returning();
  if (!payout) return;
  const refunded = await db()
    .update(schema.contributions)
    .set({ status: "refunded" })
    .where(and(eq(schema.contributions.billId, payout.billId), eq(schema.contributions.status, "succeeded")))
    .returning();
  if (env().PAYMENTS_MODE === "stripe") {
    for (const c of refunded) if (c.stripePaymentIntentId) await refundContribution(c.stripePaymentIntentId, c.id);
  }
  await db()
    .update(schema.bills)
    .set({ status: "rejected", fundedCents: sql`0`, reviewNote: `Biller rejected payment: ${reason.slice(0, 200)}` })
    .where(eq(schema.bills.id, payout.billId));
  await audit("payout.rejected", { target: payout.billId, meta: { partnerRef, refunded: refunded.length } });
}
