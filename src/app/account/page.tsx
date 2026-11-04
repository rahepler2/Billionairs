import type { Metadata } from "next";
import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AccountForm } from "@/components/AccountForm";
import { currentUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { formatUSD } from "@/lib/fees";
import { impactPoints, tierFor } from "@/lib/honor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/signin");
  const [totals] = await db()
    .select({
      paidCents: sql<number>`coalesce(sum(${schema.contributions.amountCents}),0)::int`,
      households: sql<number>`count(distinct ${schema.contributions.billId})::int`,
    })
    .from(schema.contributions)
    .where(and(eq(schema.contributions.donorId, user.id), eq(schema.contributions.status, "succeeded")));
  const paidCents = totals?.paidCents ?? 0;
  const households = totals?.households ?? 0;
  const tier = tierFor(paidCents);

  return (
    <div className="container section narrow stack">
      <h1>Your impact</h1>
      <div className="card luminary lit">
        <span className="halo" aria-hidden="true" />
        <span className="badge gold">{tier.label}</span>
        <div className="bill-amount">{formatUSD(paidCents)}</div>
        <p className="muted">
          {households} household{households === 1 ? "" : "s"} lifted · {impactPoints({ paidCents, households }).toLocaleString()} impact
          points. {tier.blurb}
        </p>
      </div>
      <AccountForm displayName={user.displayName} city={user.city ?? ""} showOnHonorRoll={user.showOnHonorRoll} />
      <div className="card flat stack">
        <h3>Your data</h3>
        <p className="small muted">Download everything we hold about you, or delete your account. Both require a fresh passkey check.</p>
        <div className="row">
          <a className="btn ghost sm" href="/api/account/export">
            Download my data
          </a>
        </div>
      </div>
    </div>
  );
}
