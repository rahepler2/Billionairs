import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, currentUser, markElevated } from "@/lib/auth/session";
import { consumeChallenge, rp } from "@/lib/auth/webauthn";
import { db, schema } from "@/lib/db";
import { HttpError, assertSameOrigin, clientIp, handler, parseJson, rateLimit } from "@/lib/http";
import { audit } from "@/lib/security/audit";

const body = z.object({ challengeId: z.string(), response: z.custom<AuthenticationResponseJSON>((v) => !!v && typeof v === "object") });

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  rateLimit("auth", clientIp(req));
  const { challengeId, response } = await parseJson(req, body);
  const challenge = await consumeChallenge(challengeId, "login");
  if (!challenge) throw new HttpError(400, "Sign-in expired. Please try again.");

  const [pk] = await db().select().from(schema.passkeys).where(eq(schema.passkeys.id, String(response.id ?? "")));
  if (!pk) throw new HttpError(401, "Passkey not recognized");

  const { rpID, origin } = rp();
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
    credential: { id: pk.id, publicKey: new Uint8Array(pk.publicKey), counter: pk.counter, transports: pk.transports ?? undefined },
  }).catch(() => null);
  if (!result?.verified) {
    await audit("auth.failed", { target: pk.userId });
    throw new HttpError(401, "Passkey could not be verified");
  }
  // A counter that goes backwards suggests a cloned authenticator.
  if (pk.counter > 0 && result.authenticationInfo.newCounter <= pk.counter) {
    await audit("auth.counter_regression", { target: pk.userId });
    throw new HttpError(401, "Passkey could not be verified");
  }
  await db().update(schema.passkeys).set({ counter: result.authenticationInfo.newCounter, lastUsedAt: new Date() }).where(eq(schema.passkeys.id, pk.id));

  const existing = await currentUser();
  if (existing?.id === pk.userId) {
    await markElevated(); // step-up re-verification
    await audit("auth.step_up", { actorId: pk.userId });
  } else {
    await createSession(pk.userId, { elevated: true });
    await audit("auth.login", { actorId: pk.userId });
  }
  return NextResponse.json({ ok: true });
});
