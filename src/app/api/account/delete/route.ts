import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, schema } from "@/lib/db";
import { HttpError, assertSameOrigin, handler, requireUser } from "@/lib/http";
import { SESSION_COOKIE, isElevated } from "@/lib/auth/session";
import { audit } from "@/lib/security/audit";

/**
 * Account deletion. Payment records must be retained for legal/accounting
 * minimums, so the account is anonymized: PII destroyed, credentials and
 * sessions removed, public attribution replaced with "Anonymous".
 */
export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireUser();
  if (!(await isElevated())) throw new HttpError(403, "Re-verify with your passkey to delete your account");
  await db().transaction(async (tx) => {
    await tx
      .update(schema.users)
      .set({ displayName: "Deleted account", city: null, legalNameEnc: null, addressEnc: null, showOnHonorRoll: false, verifiedAt: null })
      .where(eq(schema.users.id, user.id));
    await tx.update(schema.bills).set({ posterFirstName: null, posterCity: null, anonymous: true }).where(eq(schema.bills.posterId, user.id));
    await tx.update(schema.contributions).set({ anonymous: true }).where(eq(schema.contributions.donorId, user.id));
    await tx.delete(schema.passkeys).where(eq(schema.passkeys.userId, user.id));
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, user.id));
  });
  (await cookies()).delete(SESSION_COOKIE);
  await audit("account.deleted", { actorId: user.id });
  return NextResponse.json({ ok: true });
});
