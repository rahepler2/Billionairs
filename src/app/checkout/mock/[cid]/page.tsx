import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { MockPayButton } from "@/components/MockPayButton";
import { currentUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { formatUSD } from "@/lib/fees";

export const dynamic = "force-dynamic";

/** Stand-in for Stripe Checkout when PAYMENTS_MODE=mock. Never available in production. */
export default async function MockCheckout({ params }: { params: Promise<{ cid: string }> }) {
  if (env().PAYMENTS_MODE !== "mock" || env().NODE_ENV === "production") notFound();
  const { cid } = await params;
  const user = await currentUser();
  if (!user || !/^[0-9a-f-]{36}$/i.test(cid)) notFound();
  const [row] = await db()
    .select({ c: schema.contributions, billerName: schema.bills.billerName })
    .from(schema.contributions)
    .innerJoin(schema.bills, eq(schema.bills.id, schema.contributions.billId))
    .where(and(eq(schema.contributions.id, cid), eq(schema.contributions.donorId, user.id)));
  if (!row) notFound();
  const { c } = row;
  return (
    <div className="container section narrow">
      <div className="card stack">
        <span className="badge warn">Test mode: no real money moves</span>
        <h1>Checkout</h1>
        <p className="muted">This simulates Stripe Checkout and the bill-pay partner so you can try the full loop locally.</p>
        <div className="fee-lines">
          <span>Lift to {row.billerName}</span>
          <span>{formatUSD(c.amountCents)}</span>
          <span className="muted">Platform fee</span>
          <span className="muted">{formatUSD(c.platformFeeCents)}</span>
          <span className="muted">Card processing</span>
          <span className="muted">{formatUSD(c.processingFeeCents)}</span>
          <span className="total">Total</span>
          <span className="total">{formatUSD(c.totalCents)}</span>
        </div>
        {c.status === "pending" ? <MockPayButton cid={c.id} /> : <p className="notice">This checkout is already {c.status}.</p>}
      </div>
    </div>
  );
}
