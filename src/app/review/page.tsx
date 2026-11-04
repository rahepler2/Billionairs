import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ReviewActions } from "@/components/ReviewActions";
import { currentUser, isElevated } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { formatUSD } from "@/lib/fees";
import { CATEGORY_LABELS, HUMAN_REVIEW_OVER_CENTS } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verification queue", robots: { index: false } };

const FLAG_LABELS: Record<string, string> = {
  biller_not_in_directory: "Biller not in known-biller directory: confirm by phone",
  over_human_review_threshold: `Over ${formatUSD(HUMAN_REVIEW_OVER_CENTS)}: human review required`,
  possible_duplicate: "Looks like a bill we've seen before",
  story_pii_redacted: "Personal details were removed from the story",
  model_flagged_document: "Extraction model flagged the document",
  no_account_number_visible: "No account number visible on the document",
  pdf_modified_after_creation: "PDF was modified after it was created",
};

export default async function ReviewPage() {
  const user = await currentUser();
  if (!user || (user.role !== "reviewer" && user.role !== "admin")) notFound();
  const elevated = await isElevated();
  const queue = await db().select().from(schema.bills).where(eq(schema.bills.status, "pending_review")).orderBy(asc(schema.bills.createdAt)).limit(50);

  return (
    <div className="container section stack">
      <div>
        <p className="eyebrow">Staff only</p>
        <h1>Verification queue</h1>
        <p className="muted narrow">
          Confirm each balance with the biller before approving. Viewing a document requires a recent passkey check and is written to the
          audit log. Uploads are destroyed the moment you decide.
        </p>
      </div>
      {queue.length === 0 ? <p className="muted">The queue is clear. Nice work.</p> : null}
      {queue.map((b) => (
        <article key={b.id} className="card stack">
          <div className="row spread">
            <h3 style={{ margin: 0 }}>
              {formatUSD(b.amountCents)} · {b.billerName}
            </h3>
            <span className="tiny">Submitted {b.createdAt.toLocaleDateString()}</span>
          </div>
          <div className="row small muted">
            <span>{CATEGORY_LABELS[b.category]}</span>
            <span>Due {b.dueDate}</span>
            <span>Account ••••{b.accountLast4}</span>
            <span>Fields: {b.extractedBy === "anthropic" ? "model-extracted, poster-confirmed" : "entered by poster"}</span>
            <span>{b.billerId ? "✓ Known biller" : "Unknown biller"}</span>
          </div>
          {b.flags.length ? (
            <div className="row">
              {b.flags.map((f) => (
                <span key={f} className="badge warn">
                  {FLAG_LABELS[f] ?? f.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          ) : (
            <span className="badge verified">No automated flags</span>
          )}
          {b.story ? <p className="story">“{b.story}”</p> : null}
          {b.uploadKey ? (
            elevated ? (
              <a className="small" href={`/api/review/${b.id}/document`} target="_blank" rel="noopener noreferrer">
                View document (logged)
              </a>
            ) : (
              <span className="small muted">Sign in again with your passkey to view the document.</span>
            )
          ) : null}
          <ReviewActions billId={b.id} hasStory={!!b.story} />
        </article>
      ))}
    </div>
  );
}
