import Link from "next/link";
import { formatUSD } from "@/lib/fees";
import type { PublicBill } from "@/lib/queries";
import { CATEGORY_LABELS } from "@/lib/validation";
import { Progress } from "./Progress";

export function dueLabel(dueDate: string, now = new Date()) {
  const days = Math.ceil((Date.parse(`${dueDate}T23:59:59Z`) - now.getTime()) / 86_400_000);
  if (days < 0) return { text: "Past due", urgent: true };
  if (days === 0) return { text: "Due today", urgent: true };
  return { text: `Due in ${days} day${days === 1 ? "" : "s"}`, urgent: days <= 7 };
}

export function BillCard({ bill }: { bill: PublicBill }) {
  const due = dueLabel(bill.dueDate);
  return (
    <Link href={`/bills/${bill.id}`} className="card bill-card">
      <div className="row spread">
        <span className="badge verified">✓ Verified</span>
        {bill.status === "paid" ? (
          <span className="badge gold">Lifted ✦</span>
        ) : (
          <span className={`badge ${due.urgent ? "warn" : ""}`}>{due.text}</span>
        )}
      </div>
      <div>
        <div className="bill-amount">{formatUSD(bill.amountCents)}</div>
        <div className="muted">
          {CATEGORY_LABELS[bill.category]} · {bill.billerName}
        </div>
      </div>
      {bill.story ? <p className="story">“{bill.story}”</p> : null}
      <Progress funded={bill.fundedCents} total={bill.amountCents} />
      <div className="row spread small muted">
        <span>{bill.attribution}</span>
        <span>▲ {bill.voteCount}</span>
      </div>
    </Link>
  );
}
