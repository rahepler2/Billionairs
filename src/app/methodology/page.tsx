import type { Metadata } from "next";
import { POINTS_PER_DOLLAR, POINTS_PER_HOUSEHOLD, TIERS } from "@/lib/honor";
import { formatUSD } from "@/lib/fees";
import { RANK_WEIGHTS } from "@/lib/ranking";

export const metadata: Metadata = { title: "Methodology" };

export default function Methodology() {
  return (
    <div className="container section narrow stack">
      <h1>Methodology</h1>
      <p className="muted">Lifted only publishes claims we can prove. Here is exactly how every number on the site is produced.</p>

      <h2>What counts as a Lift</h2>
      <p>
        A Lift is a payment that cleared through Stripe and was sent to the biller by our licensed bill-pay partner. Pending, failed and
        refunded payments never count. If a biller rejects a payment, every giver is refunded in full and the totals are reversed.
      </p>

      <h2>The Honor Roll</h2>
      <p>
        Givers are ranked by <strong>impact points</strong>: {POINTS_PER_DOLLAR} point per dollar paid to billers plus {POINTS_PER_HOUSEHOLD}{" "}
        points for each distinct household helped. Weighting households stops anyone gaming the board by splitting gifts or by funding a
        single large bill. Appearing is opt-in; anonymous Lifts are never shown.
      </p>
      <ul>
        {TIERS.map((t) => (
          <li key={t.key}>
            <strong>{t.label}</strong>
            {t.minCents > 0 ? ` (${formatUSD(t.minCents)}+ paid)` : ""}: {t.blurb}
          </li>
        ))}
      </ul>

      <h2>The Luminaries</h2>
      <p>
        Every person on our source billionaire list gets a reserved seat, by name only. We use no photos, logos, or wording that implies
        endorsement. A seat shows only what was paid <em>through Lifted</em>; it is never a measure of anyone&apos;s overall generosity. To
        give the full picture, each seat shows the person&apos;s publicly documented philanthropy elsewhere, with a source link.
      </p>
      <p>
        <strong>Corrections:</strong> anyone listed, or their office, can request a correction or claim their seat. We respond within 48
        hours.
      </p>

      <h2>How bills are ranked</h2>
      <p>
        The bill feed blends three signals: community votes (log-damped, weight {RANK_WEIGHTS.votes}), urgency based on days until the due
        date (weight {RANK_WEIGHTS.urgency}), and time spent waiting (weight {RANK_WEIGHTS.waiting}). Bills that are nearly funded get a small
        boost to cross the line. Votes come from verified accounts only, one per bill, with a daily budget.
      </p>

      <h2>Verification</h2>
      <p>
        Each bill passes document forensics, duplicate detection on redacted fields, a known-biller directory check, and confirmation of the
        balance with the biller. Anything flagged or over $1,000 gets human review. Unverified bills never go live.
      </p>
    </div>
  );
}
