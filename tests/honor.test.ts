import { describe, expect, it } from "vitest";
import { impactPoints, rankGivers, tierFor } from "@/lib/honor";

describe("Honor Roll", () => {
  it("rewards households helped, not just dollars", () => {
    // $1,000 to one bill vs $900 spread across 4 households
    expect(impactPoints({ paidCents: 90_000, households: 4 })).toBeGreaterThan(impactPoints({ paidCents: 100_000, households: 1 }));
  });

  it("assigns celebratory tiers, with an open seat at $0", () => {
    expect(tierFor(0).key).toBe("open");
    expect(tierFor(500).key).toBe("lifter");
    expect(tierFor(100_000).key).toBe("champion");
    expect(tierFor(2_500_000).key).toBe("patron");
    expect(tierFor(25_000_000).key).toBe("luminary");
  });

  it("ranks by points and numbers ranks from 1", () => {
    const r = rankGivers([
      { id: "a", paidCents: 1_000, households: 1 },
      { id: "b", paidCents: 50_000, households: 2 },
    ]);
    expect(r.map((x) => [x.id, x.rank])).toEqual([
      ["b", 1],
      ["a", 2],
    ]);
  });
});
