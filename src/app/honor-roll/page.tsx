import type { Metadata } from "next";
import Link from "next/link";
import { formatUSD } from "@/lib/fees";
import { TIERS } from "@/lib/honor";
import { honorRoll, luminaryBoard } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Honor Roll" };

export default async function HonorRollPage() {
  const [givers, board] = await Promise.all([honorRoll(100), luminaryBoard()]);
  return (
    <div className="container section stack">
      <div>
        <p className="eyebrow">The Honor Roll</p>
        <h1>Everyone who showed up</h1>
        <p className="muted narrow">
          Ranked by verified impact: dollars paid to billers <em>and</em> households helped. Only payments that cleared are counted. Givers
          choose whether to appear. <Link href="/methodology">How the ranking works</Link>
        </p>
        <div className="row" style={{ marginTop: 8 }}>
          {TIERS.filter((t) => t.key !== "open").map((t) => (
            <span key={t.key} className="badge gold" title={t.blurb}>
              {t.label} · {formatUSD(t.minCents)}+
            </span>
          ))}
        </div>
      </div>

      <section id="luminaries" className="section" style={{ paddingBottom: 24 }}>
        <p className="eyebrow">The Luminaries</p>
        <h2>The world&apos;s greatest givers</h2>
        <p className="muted narrow">
          Every person on a public billionaire list has a seat here. Lifts made through Lifted are verified and celebrated, and we show each
          person&apos;s publicly documented philanthropy elsewhere, with sources, so the full picture of their generosity is always visible.
        </p>
        {board.lit.length ? (
          <div className="grid" style={{ marginBottom: 24 }}>
            {board.lit.map((l) => (
              <Link key={l.id} href={`/honor-roll/luminaries/${l.slug}`} className="card luminary lit bill-card">
                <span className="halo" aria-hidden="true" />
                <div className="row">
                  <span className="badge gold">#{l.rank} · {l.tier.label}</span>
                  {l.claimedAt ? <span className="badge verified">✓ Claimed</span> : null}
                </div>
                <h3>{l.name}</h3>
                <div className="bill-amount">{formatUSD(l.paidCents)}</div>
                <div className="muted small">{l.households.toLocaleString()} households lifted · {l.points.toLocaleString()} impact pts</div>
                {l.statement ? <p className="story small">“{l.statement}”</p> : null}
              </Link>
            ))}
          </div>
        ) : null}
        <h3>Seats reserved for a first Lift</h3>
        <div className="grid">
          {board.reserved.map((l) => (
            <Link key={l.id} href={`/honor-roll/luminaries/${l.slug}`} className="card seat bill-card">
              <span className="badge">Seat reserved</span>
              <strong>{l.name}</strong>
              {l.knownGiving ? <span className="small muted">Known for: {l.knownGiving}</span> : null}
              <span className="tiny">Paid through Lifted so far: {formatUSD(0)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2>Everyday givers</h2>
        {givers.length ? (
          <div className="table-wrap card flat">
            <table className="honor-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Giver</th>
                  <th>Tier</th>
                  <th className="num">Households</th>
                  <th className="num">Paid to billers</th>
                  <th className="num">Impact</th>
                </tr>
              </thead>
              <tbody>
                {givers.map((g) => (
                  <tr key={`${g.rank}-${g.name}`}>
                    <td>{g.rank}</td>
                    <td>
                      <strong>{g.name}</strong>
                      {g.city ? <div className="tiny">{g.city}</div> : null}
                    </td>
                    <td>
                      <span className="badge gold">{g.tier.label}</span>
                    </td>
                    <td className="num">{g.households}</td>
                    <td className="num">{formatUSD(g.paidCents)}</td>
                    <td className="num">{g.points.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">The first name on the Honor Roll could be yours.</p>
        )}
      </section>
    </div>
  );
}
