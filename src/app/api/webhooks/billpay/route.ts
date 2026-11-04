import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { verifyBillPaySignature } from "@/lib/payments/billpay";
import { claimEvent, confirmPayout, rejectPayout } from "@/lib/payments/ledger";

const eventSchema = z.object({
  id: z.string().min(1).max(200),
  type: z.enum(["payment.confirmed", "payment.rejected"]),
  data: z.object({ partner_ref: z.string().min(1).max(200), reason: z.string().max(500).optional() }),
});

/** Bill-pay partner confirmation webhook: HMAC + timestamp tolerance + event-id idempotency. */
export async function POST(req: NextRequest) {
  const secret = env().BILLPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const raw = await req.text();
  if (raw.length > 64_000 || !verifyBillPaySignature(secret, raw, req.headers.get("x-billpay-signature"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }
  const parsed = eventSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) return NextResponse.json({ error: "bad payload" }, { status: 400 });
  const evt = parsed.data;
  if (!(await claimEvent(evt.id, "billpay"))) return NextResponse.json({ ok: true, duplicate: true });

  if (evt.type === "payment.confirmed") await confirmPayout(evt.data.partner_ref);
  else await rejectPayout(evt.data.partner_ref, evt.data.reason ?? "unspecified");
  return NextResponse.json({ ok: true });
}
