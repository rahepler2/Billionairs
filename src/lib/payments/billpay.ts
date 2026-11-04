import "server-only";
import { hmacSha256Hex, randomToken, safeEqual } from "@/lib/security/crypto";

/**
 * Licensed bill-pay partner adapter (spec: "Why not pay billers directly
 * through Stripe"). The partner holds the money-transmitter licenses, reaches
 * the biller network, and confirms the payment landed via a signed webhook.
 * Lifted never holds or moves funds itself.
 *
 * Implement `BillPayPartner` for the chosen provider (Method Financial,
 * Paymentus, ...). The mock adapter is used in local development.
 */
export interface PayoutRequest {
  billId: string;
  billerName: string;
  partnerBillerId: string | null;
  accountNumber: string; // detokenized just-in-time, never logged
  amountCents: number;
}

export interface BillPayPartner {
  submitPayment(req: PayoutRequest): Promise<{ partnerRef: string }>;
}

export class MockBillPayPartner implements BillPayPartner {
  async submitPayment(req: PayoutRequest) {
    if (!req.accountNumber) throw new Error("account number required");
    return { partnerRef: `mock_pay_${randomToken(10)}` };
  }
}

export function billPayPartner(): BillPayPartner {
  // Swap in the real adapter here once a partner is contracted.
  return new MockBillPayPartner();
}

// ── Signed webhooks from the partner ─────────────────────────────────────────

export const SIGNATURE_TOLERANCE_SEC = 300;

export function signBillPayPayload(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},v1=${hmacSha256Hex(secret, `${timestamp}.${body}`)}`;
}

/** Verifies HMAC + timestamp tolerance (replay protection). Event ids are de-duplicated separately. */
export function verifyBillPaySignature(secret: string, body: string, header: string | null, now = Math.floor(Date.now() / 1000)): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(now - t) > SIGNATURE_TOLERANCE_SEC || !parts.v1) return false;
  return safeEqual(hmacSha256Hex(secret, `${t}.${body}`), parts.v1);
}
