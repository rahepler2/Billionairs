import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { HttpError, handler, requireUser } from "@/lib/http";
import { isElevated } from "@/lib/auth/session";
import { audit } from "@/lib/security/audit";
import { readUpload } from "@/lib/security/uploads";

/** Every view of a raw bill document is step-up gated and written to the audit log. */
export const GET = handler<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const reviewer = await requireUser(["reviewer", "admin"]);
  if (!(await isElevated())) throw new HttpError(403, "Re-verify with your passkey to view documents");
  const { id } = await params;
  const [bill] = await db().select({ uploadKey: schema.bills.uploadKey, status: schema.bills.status }).from(schema.bills).where(eq(schema.bills.id, id));
  if (!bill?.uploadKey || bill.status !== "pending_review") throw new HttpError(404, "Document no longer exists");
  const { bytes, mediaType } = await readUpload(bill.uploadKey);
  await audit("review.document_viewed", { actorId: reviewer.id, target: id });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mediaType,
      "Cache-Control": "no-store, private",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
