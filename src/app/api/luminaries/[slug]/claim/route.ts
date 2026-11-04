import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { HttpError, assertSameOrigin, clientIp, handler, parseJson, rateLimit, requireUser } from "@/lib/http";
import { luminaryBySlug } from "@/lib/queries";
import { audit } from "@/lib/security/audit";
import { seal } from "@/lib/security/crypto";
import { dataKeys } from "@/lib/security/keys";
import { claimSchema } from "@/lib/validation";

/** "Claim your seat": a request that staff verify offline with the person's office before linking. */
export const POST = handler<{ params: Promise<{ slug: string }> }>(async (req, { params }) => {
  assertSameOrigin(req);
  const user = await requireUser();
  rateLimit("claim", user.id, clientIp(req));
  const { slug } = await params;
  const lum = await luminaryBySlug(slug);
  if (!lum) throw new HttpError(404, "Profile not found");
  if (lum.userId) throw new HttpError(409, "This seat has already been claimed");
  const { contact } = await parseJson(req, claimSchema);
  const [claim] = await db()
    .insert(schema.profileClaims)
    .values({ luminaryId: lum.id, requesterId: user.id, contactEnc: seal(dataKeys(), contact, `claim:${lum.id}:${user.id}`) })
    .returning({ id: schema.profileClaims.id });
  await audit("luminary.claim_requested", { actorId: user.id, target: lum.id, meta: { claimId: claim!.id } });
  return NextResponse.json({ ok: true }, { status: 201 });
});
