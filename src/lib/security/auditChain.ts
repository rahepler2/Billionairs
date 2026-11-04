import { createHash } from "node:crypto";

/** Pure hash-chain helpers (tested in isolation). */
export const GENESIS = "0".repeat(64);

export interface AuditRecord {
  seq: number;
  at: string; // ISO
  actorId: string | null;
  action: string;
  target: string | null;
  meta: Record<string, unknown>;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function chainHash(prevHash: string, r: Omit<AuditRecord, "seq">): string {
  return createHash("sha256").update(prevHash).update(stable(r)).digest("hex");
}

/** Returns the seq of the first broken link, or null if the chain is intact. */
export function verifyChain(rows: (AuditRecord & { prevHash: string; hash: string })[]): number | null {
  let prev = GENESIS;
  for (const row of rows) {
    const { seq, prevHash, hash, ...rest } = row;
    if (prevHash !== prev || chainHash(prev, rest) !== hash) return seq;
    prev = hash;
  }
  return null;
}
