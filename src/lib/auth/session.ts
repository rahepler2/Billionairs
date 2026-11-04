import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, sha256 } from "@/lib/security/crypto";

/**
 * Opaque, server-side sessions. The cookie holds a random 256-bit token; the
 * database holds only its SHA-256, so a DB leak yields no usable sessions.
 * Idle timeout 30 min, absolute lifetime 7 days, HttpOnly + Secure + SameSite=Strict.
 * Sensitive actions additionally require a fresh passkey assertion (step-up).
 */
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-lifted" : "lifted_session";
const IDLE_MS = 30 * 60_000;
const ABSOLUTE_MS = 7 * 86_400_000;
export const STEP_UP_MS = 10 * 60_000;

export type SessionUser = typeof schema.users.$inferSelect;

export async function createSession(userId: string, opts: { elevated?: boolean } = {}) {
  const token = randomToken(32);
  const now = Date.now();
  await db()
    .insert(schema.sessions)
    .values({
      id: sha256(token),
      userId,
      expiresAt: new Date(now + ABSOLUTE_MS),
      elevatedUntil: opts.elevated ? new Date(now + STEP_UP_MS) : null,
    });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ABSOLUTE_MS / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db().delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

/** Revoke every session for a user (password/device change, suspected takeover). */
export async function revokeAllSessions(userId: string) {
  await db().delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}

export const currentSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const id = sha256(token);
  const now = new Date();
  const [row] = await db()
    .select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, id), gt(schema.sessions.expiresAt, now)));
  if (!row) return null;
  if (now.getTime() - row.session.lastSeenAt.getTime() > IDLE_MS) {
    await db().delete(schema.sessions).where(eq(schema.sessions.id, id));
    return null;
  }
  // Touch at most once a minute to avoid a write per request.
  if (now.getTime() - row.session.lastSeenAt.getTime() > 60_000) {
    await db().update(schema.sessions).set({ lastSeenAt: now }).where(eq(schema.sessions.id, id));
  }
  return row;
});

export async function currentUser(): Promise<SessionUser | null> {
  return (await currentSession())?.user ?? null;
}

export async function markElevated() {
  const s = await currentSession();
  if (s) await db().update(schema.sessions).set({ elevatedUntil: new Date(Date.now() + STEP_UP_MS) }).where(eq(schema.sessions.id, s.session.id));
}

export async function isElevated(): Promise<boolean> {
  const s = await currentSession();
  return !!s?.session.elevatedUntil && s.session.elevatedUntil.getTime() > Date.now();
}
