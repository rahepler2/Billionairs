import { describe, expect, it } from "vitest";
import { containsPII, redactPII } from "@/lib/redact";

describe("redactPII", () => {
  it.each([
    ["SSN 123-45-6789 here", "[ssn]"],
    ["email me at jane.doe@example.com", "[email]"],
    ["call (555) 201-3344 tonight", "[phone]"],
    ["I live at 1234 Maple Grove Ave Apt 5", "[address]"],
    ["acct 4417 1234 5678 9113", "[number]"],
  ])("masks %s", (input, label) => {
    const out = redactPII(input);
    expect(out).toContain(label);
    expect(containsPII(input)).toBe(true);
  });

  it("leaves ordinary stories alone", () => {
    const s = "Two kids, lost hours at work in March. Need $180 by Friday.";
    expect(redactPII(s)).toBe(s);
  });
});
