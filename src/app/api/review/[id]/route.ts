import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { HttpError, assertSameOrigin, handler, parseJson, rateLimit, requireUser } from "@/lib/http";
import { audit } from "@/lib/security/audit";
import { deleteUpload } from "@/lib/security/uploads";
import { reviewSchema } from "@/lib/validation";

/**
 * Human verification decision. Reviewers must have stepped up with a passkey
 * recently. The raw upload is destroyed as soon as a decision is made.
 */
export const POST = handler<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  assertSameOrigin(req);
  const reviewer = await requireUser(["reviewer", "admin"]);
  rateLimit("review", reviewer.id);
  const { id } = await params;
  const { decision, note, publishStory } = await parseJson(req, reviewSchema);

  const [bill] = await db().select().from(schema.bills).where(eq(schema.bills.id, id));
  if (!bill || bill.status !== "pending_review") throw new HttpError(404, "Nothing to review here");
  if (bill.posterId === reviewer.id) throw new HttpError(403, "You can't review your own bill");

  const now = new Date();
  await db()
    .update(schema.bills)
    .set({
      status: decision === "approve" ? "live" : "rejected",
      publishedAt: decision === "approve" ? now : null,
      story: decision === "approve" && publishStory ? bill.story : null,
      reviewNote: note ?? null,
      reviewedBy: reviewer.id,
      reviewedAt: now,
      uploadKey: null,
      uploadPurgeAfter: null,
    })
    .where(and(eq(schema.bills.id, id), eq(schema.bills.status, "pending_review")));
  if (bill.uploadKey) await deleteUpload(bill.uploadKey);
  await audit(`review.${decision}`, { actorId: reviewer.id, target: id, meta: { flags: bill.flags } });
  return NextResponse.json({ ok: true });
});
