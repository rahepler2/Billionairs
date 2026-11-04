import { generateRegistrationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { storeChallenge, rp } from "@/lib/auth/webauthn";
import { assertSameOrigin, clientIp, handler, parseJson, rateLimit } from "@/lib/http";
import { displayNameSchema } from "@/lib/validation";

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  rateLimit("auth", clientIp(req));
  const { displayName } = await parseJson(req, z.object({ displayName: displayNameSchema }));
  const { rpID, rpName } = rp();
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: displayName,
    userDisplayName: displayName,
    attestationType: "none",
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  const challengeId = await storeChallenge(options.challenge, "register", displayName);
  return NextResponse.json({ challengeId, options });
});
