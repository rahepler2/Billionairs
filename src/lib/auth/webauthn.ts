import "server-only";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";

export const CHALLENGE_TTL_MS = 5 * 60_000;

export function rp() {
  const { WEBAUTHN_RP_ID, WEBAUTHN_RP_NAME, APP_URL } = env();
  return { rpID: WEBAUTHN_RP_ID, rpName: WEBAUTHN_RP_NAME, origin: new URL(APP_URL).origin };
}

export async function storeChallenge(challenge: string, kind: "register" | "login", displayName?: string) {
  // Opportunistic cleanup of expired challenges.
  await db().delete(schema.authChallenges).where(lt(schema.authChallenges.expiresAt, new Date()));
  const [row] = await db()
    .insert(schema.authChallenges)
    .values({ challenge, kind, displayName, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) })
    .returning({ id: schema.authChallenges.id });
  return row!.id;
}

/** Single use: the challenge is deleted as it is read. */
export async function consumeChallenge(id: string, kind: "register" | "login") {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db()
    .delete(schema.authChallenges)
    .where(and(eq(schema.authChallenges.id, id), eq(schema.authChallenges.kind, kind), gt(schema.authChallenges.expiresAt, new Date())))
    .returning();
  return row ?? null;
}
