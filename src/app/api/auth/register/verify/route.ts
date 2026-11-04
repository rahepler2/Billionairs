import { verifyRegistrationResponse, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth/session";
import { consumeChallenge, rp } from "@/lib/auth/webauthn";
import { db, schema } from "@/lib/db";
import { HttpError, assertSameOrigin, clientIp, handler, parseJson, rateLimit } from "@/lib/http";
import { audit } from "@/lib/security/audit";

const body = z.object({ challengeId: z.string(), response: z.custom<RegistrationResponseJSON>((v) => !!v && typeof v === "object") });

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  rateLimit("auth", clientIp(req));
  const { challengeId, response } = await parseJson(req, body);
  const challenge = await consumeChallenge(challengeId, "register");
  if (!challenge?.displayName) throw new HttpError(400, "Sign-up expired. Please try again.");

  const { rpID, origin } = rp();
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  }).catch(() => null);
  if (!result?.verified) throw new HttpError(400, "Passkey could not be verified");

  const { credential } = result.registrationInfo;
  const userId = await db().transaction(async (tx) => {
    const [user] = await tx
      .insert(schema.users)
      .values({ displayName: challenge.displayName!, verifiedAt: new Date() })
      .returning({ id: schema.users.id });
    await tx.insert(schema.passkeys).values({
      id: credential.id,
      userId: user!.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
    });
    return user!.id;
  });
  await createSession(userId, { elevated: true });
  await audit("auth.registered", { actorId: userId });
  return NextResponse.json({ ok: true });
});
