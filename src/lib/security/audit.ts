import "server-only";
import { desc, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { GENESIS, chainHash } from "./auditChain";

/**
 * Append to the tamper-evident audit log. A transaction-scoped advisory lock
 * serializes writers so the chain never forks. In production, also ship each
 * row to a write-once SIEM bucket so a DB admin can't rewrite history.
 */
export async function audit(action: string, opts: { actorId?: string | null; target?: string | null; meta?: Record<string, unknown> } = {}) {
  await db().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(727274)`);
    const [last] = await tx.select({ hash: schema.auditLog.hash }).from(schema.auditLog).orderBy(desc(schema.auditLog.seq)).limit(1);
    const prevHash = last?.hash ?? GENESIS;
    const at = new Date();
    const record = { at: at.toISOString(), actorId: opts.actorId ?? null, action, target: opts.target ?? null, meta: opts.meta ?? {} };
    await tx.insert(schema.auditLog).values({ ...record, at, prevHash, hash: chainHash(prevHash, record) });
  });
}
