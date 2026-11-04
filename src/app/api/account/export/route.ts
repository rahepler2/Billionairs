import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { HttpError, handler, requireUser } from "@/lib/http";
import { isElevated } from "@/lib/auth/session";
import { audit } from "@/lib/security/audit";
import { open } from "@/lib/security/crypto";
import { dataKeys } from "@/lib/security/keys";

/** GDPR/CCPA self-serve export. Step-up gated because it decrypts PII. */
export const GET = handler(async () => {
  const user = await requireUser();
  if (!(await isElevated())) throw new HttpError(403, "Re-verify with your passkey to export your data");
  const keys = dataKeys();
  const bills = await db()
    .select({
      id: schema.bills.id,
      billerName: schema.bills.billerName,
      amountCents: schema.bills.amountCents,
      dueDate: schema.bills.dueDate,
      status: schema.bills.status,
      story: schema.bills.story,
      accountLast4: schema.bills.accountLast4,
      createdAt: schema.bills.createdAt,
    })
    .from(schema.bills)
    .where(eq(schema.bills.posterId, user.id));
  const contributions = await db()
    .select({
      billId: schema.contributions.billId,
      amountCents: schema.contributions.amountCents,
      totalCents: schema.contributions.totalCents,
      status: schema.contributions.status,
      createdAt: schema.contributions.createdAt,
    })
    .from(schema.contributions)
    .where(eq(schema.contributions.donorId, user.id));
  await audit("account.exported", { actorId: user.id });
  return NextResponse.json(
    {
      profile: {
        displayName: user.displayName,
        city: user.city,
        showOnHonorRoll: user.showOnHonorRoll,
        legalName: user.legalNameEnc ? open(keys, user.legalNameEnc, `user:${user.id}:legal_name`) : null,
        address: user.addressEnc ? open(keys, user.addressEnc, `user:${user.id}:address`) : null,
        createdAt: user.createdAt,
      },
      bills,
      contributions,
    },
    { headers: { "Cache-Control": "no-store", "Content-Disposition": "attachment; filename=lifted-export.json" } },
  );
});
