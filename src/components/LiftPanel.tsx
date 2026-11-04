"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DEFAULT_FEES, computeFees, formatUSD } from "@/lib/fees";
import { MIN_CONTRIBUTION_CENTS } from "@/lib/validation";
import { postJson } from "./api";

export function LiftPanel({ billId, remainingCents, platformFeeBps, signedIn }: { billId: string; remainingCents: number; platformFeeBps: number; signedIn: boolean }) {
  const presets = [2500, 5000, 10000].filter((p) => p < remainingCents);
  const [dollars, setDollars] = useState(String(remainingCents / 100));
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cents = Math.min(remainingCents, Math.round(Number(dollars) * 100) || 0);
  const fees = useMemo(() => (cents >= MIN_CONTRIBUTION_CENTS ? computeFees(cents, { ...DEFAULT_FEES, platformFeeBps }) : null), [cents, platformFeeBps]);

  return (
    <div className="card">
      <h3>Lift this bill</h3>
      <p className="muted small">{formatUSD(remainingCents)} to go. 100% of your Lift reaches the biller.</p>
      <div className="row" style={{ marginBottom: 12 }}>
        {presets.map((p) => (
          <button key={p} type="button" className="btn ghost sm" onClick={() => setDollars(String(p / 100))}>
            {formatUSD(p)}
          </button>
        ))}
        <button type="button" className="btn ghost sm" onClick={() => setDollars(String(remainingCents / 100))}>
          The whole bill
        </button>
      </div>
      <div className="field">
        <label htmlFor="amt">Your Lift (USD)</label>
        <input id="amt" type="number" inputMode="decimal" min={MIN_CONTRIBUTION_CENTS / 100} max={remainingCents / 100} step="1" value={dollars} onChange={(e) => setDollars(e.target.value)} />
      </div>
      {fees ? (
        <div className="fee-lines small" style={{ marginBottom: 12 }}>
          <span>To the biller</span>
          <span>{formatUSD(fees.amountCents)}</span>
          <span className="muted">Platform fee ({platformFeeBps / 100}%)</span>
          <span className="muted">{formatUSD(fees.platformFeeCents)}</span>
          <span className="muted">Card processing</span>
          <span className="muted">{formatUSD(fees.processingFeeCents)}</span>
          <span className="total">You pay</span>
          <span className="total">{formatUSD(fees.totalCents)}</span>
        </div>
      ) : (
        <p className="small muted">Minimum Lift is {formatUSD(MIN_CONTRIBUTION_CENTS)}.</p>
      )}
      <label className="checkbox small" style={{ marginBottom: 12 }}>
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
        <span>Lift anonymously (you won&apos;t appear on the Honor Roll for this one)</span>
      </label>
      {signedIn ? (
        <button
          className="btn gold block"
          disabled={!fees || busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              const r = await postJson<{ url: string }>(`/api/bills/${billId}/checkout`, { amountCents: cents, anonymous });
              window.location.href = r.url;
            } catch (e) {
              setErr((e as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? "Opening secure checkout…" : fees ? `Lift ${formatUSD(fees.amountCents)}` : "Lift"}
        </button>
      ) : (
        <Link className="btn gold block" href="/signin">
          Sign in to Lift
        </Link>
      )}
      {err ? (
        <p className="notice err small" role="alert" style={{ marginTop: 10 }}>
          {err}
        </p>
      ) : null}
      <p className="tiny" style={{ marginTop: 10 }}>
        Card details are entered on Stripe&apos;s secure checkout and never touch Lifted&apos;s servers.
      </p>
    </div>
  );
}
