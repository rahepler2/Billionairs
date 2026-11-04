import type { Metadata } from "next";
import { BillCard } from "@/components/BillCard";
import { liveBills } from "@/lib/queries";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/validation";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bills" };

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const all = await liveBills(200);
  const bills = CATEGORIES.includes(category as (typeof CATEGORIES)[number]) ? all.filter((b) => b.category === category) : all;
  return (
    <div className="container section">
      <p className="eyebrow">Verified and waiting</p>
      <h1>Bills that need a Lift</h1>
      <p className="muted narrow">
        Ranked by a blend of community votes, how soon each bill is due, and how long it has waited, so quieter needs don&apos;t get buried.
        Every bill here was confirmed with the biller.
      </p>
      <nav className="row" aria-label="Filter by category" style={{ margin: "16px 0 24px" }}>
        <Link className={`badge ${!category ? "gold" : ""}`} href="/bills">
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link key={c} className={`badge ${category === c ? "gold" : ""}`} href={`/bills?category=${c}`}>
            {CATEGORY_LABELS[c]}
          </Link>
        ))}
      </nav>
      {bills.length ? (
        <div className="grid">
          {bills.map((b) => (
            <BillCard key={b.id} bill={b} />
          ))}
        </div>
      ) : (
        <p className="muted">No verified bills in this category right now.</p>
      )}
    </div>
  );
}
