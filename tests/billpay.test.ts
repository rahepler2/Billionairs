import { describe, expect, it } from "vitest";
import { signBillPayPayload, verifyBillPaySignature } from "@/lib/payments/billpay";

const secret = "whsec_test_123";
const body = JSON.stringify({ id: "evt_1", type: "payment.confirmed", data: { partner_ref: "p1" } });

describe("bill-pay webhook signatures", () => {
  it("accepts a fresh, correctly signed payload", () => {
    const now = 1_800_000_000;
    expect(verifyBillPaySignature(secret, body, signBillPayPayload(secret, body, now), now)).toBe(true);
  });

  it("rejects a modified body", () => {
    const now = 1_800_000_000;
    expect(verifyBillPaySignature(secret, body.replace("p1", "p2"), signBillPayPayload(secret, body, now), now)).toBe(false);
  });

  it("rejects replays outside the 5-minute tolerance", () => {
    const signedAt = 1_800_000_000;
    expect(verifyBillPaySignature(secret, body, signBillPayPayload(secret, body, signedAt), signedAt + 301)).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    expect(verifyBillPaySignature(secret, body, null)).toBe(false);
    expect(verifyBillPaySignature(secret, body, "garbage")).toBe(false);
  });
});
