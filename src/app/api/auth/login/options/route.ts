import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { rp, storeChallenge } from "@/lib/auth/webauthn";
import { assertSameOrigin, clientIp, handler, rateLimit } from "@/lib/http";

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  rateLimit("auth", clientIp(req));
  // Discoverable credentials: no allowCredentials list, so we never reveal which accounts exist.
  const options = await generateAuthenticationOptions({ rpID: rp().rpID, userVerification: "required" });
  const challengeId = await storeChallenge(options.challenge, "login");
  return NextResponse.json({ challengeId, options });
});
