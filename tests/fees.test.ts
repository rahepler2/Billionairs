import { describe, expect, it } from "vitest";
import { DEFAULT_FEES, computeFees } from "@/lib/fees";

describe("computeFees (donor-paid model)", () => {
  it("gives the bill 100% and charges 5% platform fee on top", () => {
    const f = computeFees(10_000);
    expect(f.amountCents).toBe(10_000);
    expect(f.platformFeeCents).toBe(500);
    expect(f.totalCents).toBe(f.amountCents + f.platformFeeCents + f.processingFeeCents);
  });

  it("grosses up processing so amount + platform fee survive Stripe's cut", () => {
    for (const amt of [500, 1999, 18_740, 250_000]) {
      const f = computeFees(amt);
      const stripeTakes = Math.round(f.totalCents * (DEFAULT_FEES.processingPercentBps / 10_000)) + DEFAULT_FEES.processingFixedCents;
      expect(f.totalCents - stripeTakes).toBeGreaterThanOrEqual(amt + f.platformFeeCents);
    }
  });

  it("respects a negotiated platform rate", () => {
    expect(computeFees(100_000, { ...DEFAULT_FEES, platformFeeBps: 200 }).platformFeeCents).toBe(2_000);
  });

  it("rejects non-integer or non-positive amounts", () => {
    expect(() => computeFees(0)).toThrow();
    expect(() => computeFees(10.5)).toThrow();
  });
});
