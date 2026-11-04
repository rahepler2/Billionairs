import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { dueLabel } from "@/components/BillCard";
import { LiftPanel } from "@/components/LiftPanel";
import { Progress } from "@/components/Progress";
import { ThankYouForm } from "@/components/ThankYouForm";
import { VoteButton } from "@/components/VoteButton";
import { currentUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { formatUSD } from "@/lib/fees";
import { billLifters, publicBill } from "@/lib/queries";
import { CATEGORY_LABELS } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const bill = await publicBill((await params).id);
  return bill ? { title: `${formatUSD(bill.amountCents)} ${CATEGORY_LABELS[bill.category].toLowerCase()} bill` } : {};
}

export default async function BillPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lifted?: string }> }) {
  const { id } = await params;
  const { lifted } = await searchParams;
  const [bill, user] = await Promise.all([publicBill(id), currentUser()]);
  if (!bill) notFound();
  const lifters = await billLifters(bill.id);
  const due = dueLabel(bill.dueDate);
  const remaining = bill.amountCents - bill.fundedCents;

  let hasVoted = false;
  let isPoster = false;
  if (user) {
    const [v] = await db().select().from(schema.votes).where(and(eq(schema.votes.billId, bill.id), eq(schema.votes.userId, user.id)));
    hasVoted = !!v;
    const [own] = await db().select({ id: schema.bills.id }).from(schema.bills).where(and(eq(schema.bills.id, bill.id), eq(schema.bills.posterId, user.id)));
    isPoster = !!own;
  }

  return (
    <div className="container section">
      <p className="small">
        <Link href="/bills">← All bills</Link>
      </p>
      {lifted ? (
        <div className="notice ok" role="status" style={{ marginBottom: 20 }}>
          Thank you. Your Lift is on the record. A receipt is on its way, and the biller is paid directly.
        </div>
      ) : null}
      <div className="two-col">
        <article className="card stack">
          <div className="row">
            <span className="badge verified">✓ Verified with biller</span>
            <span className="badge">{CATEGORY_LABELS[bill.category]}</span>
            {bill.status === "live" ? <span className={`badge ${due.urgent ? "warn" : ""}`}>{due.text}</span> : null}
            {bill.status === "paid" ? <span className="badge gold">Lifted ✦ paid to biller</span> : null}
            {bill.status === "funded" ? <span className="badge gold">Fully funded · paying biller</span> : null}
          </div>
          <h1 style={{ marginBottom: 0 }}>{formatUSD(bill.amountCents)}</h1>
          <p className="muted">
            {bill.billerName} · {bill.attribution}
          </p>
          {bill.story ? <p className="story">“{bill.story}”</p> : null}
          <Progress funded={bill.fundedCents} total={bill.amountCents} />
          {bill.status === "live" ? <VoteButton billId={bill.id} initialVotes={bill.voteCount} hasVoted={hasVoted} signedIn={!!user} /> : null}
          {bill.thankYou ? (
            <div className="notice ok">
              <strong>A note from {bill.attribution.split(" in ")[0]}:</strong> {bill.thankYou}
            </div>
          ) : null}
          {isPoster && bill.status === "paid" && !bill.thankYou ? <ThankYouForm billId={bill.id} /> : null}
          <div>
            <h3>Lifters</h3>
            {lifters.length ? (
              <ul className="small" style={{ paddingLeft: 18 }}>
                {lifters.map((l, i) => (
                  <li key={i}>
                    <strong>{l.name}</strong> lifted {formatUSD(l.amountCents)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Be the first to Lift this bill.</p>
            )}
          </div>
        </article>
        <aside>
          {bill.status === "live" && !isPoster ? (
            <LiftPanel billId={bill.id} remainingCents={remaining} platformFeeBps={env().PLATFORM_FEE_BPS} signedIn={!!user} />
          ) : (
            <div className="card flat">
              <h3>{bill.status === "live" ? "This is your bill" : "This bill is lifted"}</h3>
              <p className="muted small">
                {bill.status === "live"
                  ? "Share it with people you trust. Lifts go straight to your biller."
                  : "Thanks to everyone who showed up. Find another neighbor to Lift."}
              </p>
              <Link className="btn" href="/bills">
                Browse bills
              </Link>
            </div>
          )}
          <p className="tiny" style={{ marginTop: 12 }}>
            Your payment goes to the biller through a licensed bill-pay partner, never to the person who posted it. If the biller rejects
            the payment, you&apos;re refunded in full, fees included. Lifts to individuals are not tax-deductible.
          </p>
        </aside>
      </div>
    </div>
  );
}
