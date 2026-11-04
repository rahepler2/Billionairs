import "server-only";
import { eq, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { open, randomToken, seal } from "./crypto";
import { vaultKeys } from "./keys";

/**
 * Tokenization vault for biller account numbers. Callers only ever hold the
 * token and last-4. Detokenization is allowed for exactly one purpose: handing
 * the number to the licensed bill-pay partner at payout time.
 *
 * Production: run this as its own service in a separate cloud account with
 * its own KMS key, mTLS, and a two-endpoint API (tokenize / detokenize-for-payout).
 */
export async function tokenize(value: string, purpose: "biller_account"): Promise<{ token: string; last4: string }> {
  const normalized = value.replace(/[\s-]/g, "");
  const token = `tok_${randomToken(18)}`;
  await db()
    .insert(schema.vaultEntries)
    .values({ token, purpose, ciphertext: seal(vaultKeys(), normalized, `vault:${purpose}:${token}`) });
  return { token, last4: normalized.slice(-4) };
}

export async function detokenizeForPayout(token: string): Promise<string> {
  const [row] = await db().select().from(schema.vaultEntries).where(eq(schema.vaultEntries.token, token));
  if (!row) throw new Error("Unknown vault token");
  return open(vaultKeys(), row.ciphertext, `vault:${row.purpose}:${token}`);
}

/** Retention: account numbers are kept until paid + 90 days, then destroyed. */
export async function schedulePurge(token: string, after: Date) {
  await db().update(schema.vaultEntries).set({ purgeAfter: after }).where(eq(schema.vaultEntries.token, token));
}

export async function purgeExpired(now = new Date()) {
  return db().delete(schema.vaultEntries).where(lt(schema.vaultEntries.purgeAfter, now)).returning({ token: schema.vaultEntries.token });
}
