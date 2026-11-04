import { describe, expect, it } from "vitest";
import { SlidingWindowLimiter } from "@/lib/security/rateLimit";

describe("SlidingWindowLimiter", () => {
  it("blocks after the limit and recovers after the window", () => {
    const l = new SlidingWindowLimiter(3, 1000);
    expect([0, 1, 2].map((t) => l.check("k", t).ok)).toEqual([true, true, true]);
    const blocked = l.check("k", 500);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(1);
    expect(l.check("k", 1001).ok).toBe(true);
  });

  it("keys are independent", () => {
    const l = new SlidingWindowLimiter(1, 1000);
    expect(l.check("a", 0).ok).toBe(true);
    expect(l.check("b", 0).ok).toBe(true);
    expect(l.check("a", 1).ok).toBe(false);
  });
});
