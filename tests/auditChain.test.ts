import { describe, expect, it } from "vitest";
import { GENESIS, chainHash, verifyChain, type AuditRecord } from "@/lib/security/auditChain";

function build(records: Omit<AuditRecord, "seq">[]) {
  let prev = GENESIS;
  return records.map((r, i) => {
    const hash = chainHash(prev, r);
    const row = { ...r, seq: i + 1, prevHash: prev, hash };
    prev = hash;
    return row;
  });
}

const rows = () =>
  build([
    { at: "2026-11-04T00:00:00.000Z", actorId: "u1", action: "review.approve", target: "b1", meta: { flags: [] } },
    { at: "2026-11-04T00:01:00.000Z", actorId: "u2", action: "review.document_viewed", target: "b2", meta: {} },
    { at: "2026-11-04T00:02:00.000Z", actorId: null, action: "payout.confirmed", target: "b1", meta: { partnerRef: "p1" } },
  ]);

describe("tamper-evident audit chain", () => {
  it("verifies an intact chain", () => expect(verifyChain(rows())).toBeNull());

  it("detects an edited row", () => {
    const r = rows();
    r[1]!.actorId = "someone-else";
    expect(verifyChain(r)).toBe(2);
  });

  it("detects a deleted row", () => {
    const r = rows();
    r.splice(1, 1);
    expect(verifyChain(r)).toBe(3);
  });

  it("is independent of key order in meta", () => {
    const a = chainHash(GENESIS, { at: "t", actorId: null, action: "x", target: null, meta: { a: 1, b: 2 } });
    const b = chainHash(GENESIS, { at: "t", actorId: null, action: "x", target: null, meta: { b: 2, a: 1 } });
    expect(a).toBe(b);
  });
});
