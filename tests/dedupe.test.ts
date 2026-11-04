import { describe, expect, it } from "vitest";
import { DUPLICATE_THRESHOLD, canonicalText, cosine, embedFields } from "@/lib/dedupe";

const a = { billerName: "Riverside Electric Co-op", amountCents: 18_740, dueDate: "2026-11-07", accountLast4: "4821" };

describe("near-duplicate detection", () => {
  it("flags the same bill re-posted with cosmetic changes", () => {
    const b = { ...a, billerName: "RIVERSIDE ELECTRIC CO OP", dueDate: "2026-11-09" };
    expect(cosine(embedFields(a), embedFields(b))).toBeGreaterThanOrEqual(DUPLICATE_THRESHOLD);
  });

  it("does not flag a different household's bill at the same biller", () => {
    const b = { ...a, amountCents: 9_300, accountLast4: "1177" };
    expect(cosine(embedFields(a), embedFields(b))).toBeLessThan(DUPLICATE_THRESHOLD);
  });

  it("builds vectors only from redacted fields (no full account numbers)", () => {
    expect(canonicalText(a)).not.toMatch(/\d{5,}/);
  });
});
