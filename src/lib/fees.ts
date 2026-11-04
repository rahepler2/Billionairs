/**
 * Donor-paid fee model (spec: "Platform fee → Donor-paid fee (recommended)").
 * The bill receives 100% of `amountCents`. The donor pays the platform fee and
 * card processing on top. Processing is grossed up so that after Stripe takes
 * its cut, exactly amount + platform fee remain.
 *
 * Stripe's real pricing must be confirmed before launch; these are inputs.
 */
export interface FeeConfig {
  platformFeeBps: number; // 500 = 5%
  processingPercentBps: number; // 290 = 2.9%
  processingFixedCents: number; // 30
}

export const DEFAULT_FEES: FeeConfig = { platformFeeBps: 500, processingPercentBps: 290, processingFixedCents: 30 };

export interface FeeBreakdown {
  amountCents: number;
  platformFeeCents: number;
  processingFeeCents: number;
  totalCents: number;
}

export function computeFees(amountCents: number, cfg: FeeConfig = DEFAULT_FEES): FeeBreakdown {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("amount must be a positive integer of cents");
  const platformFeeCents = Math.round((amountCents * cfg.platformFeeBps) / 10_000);
  const net = amountCents + platformFeeCents;
  // total - (total * p + fixed) = net  =>  total = (net + fixed) / (1 - p)
  const p = cfg.processingPercentBps / 10_000;
  const totalCents = Math.ceil((net + cfg.processingFixedCents) / (1 - p));
  return { amountCents, platformFeeCents, processingFeeCents: totalCents - net, totalCents };
}

export const formatUSD = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 });
