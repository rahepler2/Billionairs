import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { HttpError, assertSameOrigin, handler, requireUser } from "@/lib/http";
import { recordContributionSucceeded } from "@/lib/payments/ledger";

/** Mock payment confirmation. Exists only when PAYMENTS_MODE=mock (refused in production). */
export const POST = handler<{ params: Promise<{ cid: string }> }>(async (req, { params }) => {
  if (env().PAYMENTS_MODE !== "mock" || env().NODE_ENV === "production") throw new HttpError(404, "Not found");
  assertSameOrigin(req);
  const user = await requireUser();
  const { cid } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(cid)) throw new HttpError(404, "Not found");
  const [c] = await db()
    .select()
    .from(schema.contributions)
    .where(and(eq(schema.contributions.id, cid), eq(schema.contributions.donorId, user.id)));
  if (!c) throw new HttpError(404, "Not found");
  const outcome = await recordContributionSucceeded(c.id, `mock_pi_${c.id.slice(0, 8)}`);
  return NextResponse.json({ outcome, billId: c.billId });
});
