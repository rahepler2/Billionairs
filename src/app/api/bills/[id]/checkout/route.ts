import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { DEFAULT_FEES, computeFees } from "@/lib/fees";
import { HttpError, assertSameOrigin, clientIp, handler, parseJson, rateLimit, requireUser } from "@/lib/http";
import { createCheckoutSession } from "@/lib/payments/stripe";
import { audit } from "@/lib/security/audit";
import { checkoutSchema } from "@/lib/validation";

export const POST = handler<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  assertSameOrigin(req);
  const user = await requireUser();
  rateLimit("checkout", user.id, clientIp(req));
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Bill not found");
  const body = await parseJson(req, checkoutSchema);

  const [bill] = await db().select().from(schema.bills).where(eq(schema.bills.id, id));
  if (!bill || bill.status !== "live") throw new HttpError(404, "This bill isn't accepting Lifts right now");
  if (bill.posterId === user.id) throw new HttpError(403, "You can't fund your own bill");
  const remaining = bill.amountCents - bill.fundedCents;
  const amountCents = Math.min(body.amountCents, remaining);
  if (amountCents <= 0) throw new HttpError(409, "This bill is already fully funded");

  const fees = computeFees(amountCents, { ...DEFAULT_FEES, platformFeeBps: env().PLATFORM_FEE_BPS });
  const [c] = await db()
    .insert(schema.contributions)
    .values({ billId: id, donorId: user.id, anonymous: body.anonymous, ...fees })
    .returning({ id: schema.contributions.id });

  await audit("checkout.created", { actorId: user.id, target: id, meta: { contributionId: c!.id, totalCents: fees.totalCents } });

  if (env().PAYMENTS_MODE === "mock") {
    return NextResponse.json({ url: `/checkout/mock/${c!.id}`, fees });
  }
  const session = await createCheckoutSession({ contributionId: c!.id, billId: id, billerName: bill.billerName, fees });
  await db().update(schema.contributions).set({ stripeSessionId: session.id }).where(eq(schema.contributions.id, c!.id));
  return NextResponse.json({ url: session.url, fees });
});
