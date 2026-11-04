import { describe, expect, it } from "vitest";
import { rankBills, rankScore, urgencyScore, voteScore } from "@/lib/ranking";

const now = new Date("2026-11-04T12:00:00Z");
const base = { voteCount: 0, dueDate: "2026-12-04", publishedAt: new Date("2026-11-03T12:00:00Z"), fundedCents: 0, amountCents: 10_000 };

describe("ranking", () => {
  it("treats past-due bills as maximally urgent", () => {
    expect(urgencyScore("2026-11-01", now)).toBe(1);
    expect(urgencyScore("2026-11-11", now)).toBeLessThan(urgencyScore("2026-11-05", now));
  });

  it("damps votes so popularity can't swamp urgency", () => {
    expect(voteScore(1000) - voteScore(500)).toBeLessThan(voteScore(10) - voteScore(0));
    const viral = { ...base, voteCount: 500 };
    const urgent = { ...base, voteCount: 2, dueDate: "2026-11-04", publishedAt: new Date("2026-10-22T12:00:00Z") };
    expect(rankScore(urgent, now)).toBeGreaterThan(rankScore(viral, now));
  });

  it("boosts nearly-funded bills", () => {
    expect(rankScore({ ...base, fundedCents: 9_000 }, now)).toBeGreaterThan(rankScore(base, now));
  });

  it("sorts highest score first without mutating input", () => {
    const input = [base, { ...base, dueDate: "2026-11-05" }];
    const out = rankBills(input, now);
    expect(out[0]!.dueDate).toBe("2026-11-05");
    expect(input[0]!.dueDate).toBe("2026-12-04");
  });
});
