import { and, eq, gt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { HttpError, assertSameOrigin, clientIp, handler, rateLimit, requireUser } from "@/lib/http";
import { DAILY_VOTE_BUDGET } from "@/lib/validation";

export const POST = handler<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  assertSameOrigin(req);
  const user = await requireUser();
  rateLimit("vote", user.id, clientIp(req));
  if (!user.verifiedAt) throw new HttpError(403, "Only verified accounts can vote");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Bill not found");

  const result = await db().transaction(async (tx) => {
    const [bill] = await tx.select({ status: schema.bills.status, posterId: schema.bills.posterId }).from(schema.bills).where(eq(schema.bills.id, id));
    if (!bill || bill.status !== "live") throw new HttpError(404, "This bill isn't open for votes");
    if (bill.posterId === user.id) throw new HttpError(403, "You can't vote on your own bill");
    const [used] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.votes)
      .where(and(eq(schema.votes.userId, user.id), gt(schema.votes.createdAt, new Date(Date.now() - 86_400_000))));
    if ((used?.n ?? 0) >= DAILY_VOTE_BUDGET) throw new HttpError(429, `You've used today's ${DAILY_VOTE_BUDGET} votes. Thank you for caring!`);
    const inserted = await tx.insert(schema.votes).values({ billId: id, userId: user.id }).onConflictDoNothing().returning();
    if (!inserted.length) throw new HttpError(409, "You've already backed this bill");
    const [b] = await tx
      .update(schema.bills)
      .set({ voteCount: sql`${schema.bills.voteCount} + 1` })
      .where(eq(schema.bills.id, id))
      .returning({ voteCount: schema.bills.voteCount });
    return { voteCount: b!.voteCount, remaining: DAILY_VOTE_BUDGET - (used?.n ?? 0) - 1 };
  });
  return NextResponse.json(result);
});
