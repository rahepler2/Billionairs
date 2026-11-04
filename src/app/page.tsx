import Link from "next/link";
import { BillCard } from "@/components/BillCard";
import { formatUSD } from "@/lib/fees";
import { liveBills, luminaryBoard, platformStats, recentlyPaid } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [stats, bills, paid, board] = await Promise.all([platformStats(), liveBills(6), recentlyPaid(3), luminaryBoard()]);
  const spotlight = board.lit.slice(0, 3);

  return (
    <>
      <section className="hero">
        <div className="container">
          <p className="eyebrow">Generosity, on the record</p>
          <h1>
            Real bills. Real people.
            <br />
            Real generosity.
          </h1>
          <p className="lead">
            Neighbors post verified electric, rent and medical bills. Givers pay them <strong>directly to the biller</strong>, and every Lift
            earns a public place on the Honor Roll. From first-time donors to the world&apos;s biggest philanthropists, there&apos;s a seat
            at the table for everyone who shows up.
          </p>
          <div className="row">
            <Link className="btn gold" href="/bills">
              Lift a bill
            </Link>
            <Link className="btn ghost" href="/honor-roll">
              See the Honor Roll
            </Link>
          </div>
          <div className="stats" aria-label="Platform totals">
            <div className="stat">
              <b>{formatUSD(stats.paidCents)}</b>
              <span className="muted small">paid straight to billers</span>
            </div>
            <div className="stat">
              <b>{stats.householdsLifted.toLocaleString()}</b>
              <span className="muted small">households lifted</span>
            </div>
            <div className="stat">
              <b>{stats.givers.toLocaleString()}</b>
              <span className="muted small">givers on the record</span>
            </div>
            <div className="stat">
              <b>{stats.liveBills.toLocaleString()}</b>
              <span className="muted small">verified bills waiting</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2>How a Lift works</h2>
          <ol className="steps">
            <li>
              <strong>Post</strong>
              <p className="muted small">Someone uploads a real bill. Personal details are redacted and encrypted the moment it arrives.</p>
            </li>
            <li>
              <strong>Verify</strong>
              <p className="muted small">Forensics, duplicate checks and confirmation with the biller. Unverified bills never go live.</p>
            </li>
            <li>
              <strong>Back it</strong>
              <p className="muted small">Verified members vote. Ranking blends votes, urgency and time waiting so quiet needs aren&apos;t buried.</p>
            </li>
            <li>
              <strong>Lift it</strong>
              <p className="muted small">You pay the biller directly. The bill gets 100%, you get a receipt, and your name goes on the record.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="row spread">
            <h2>Bills that need a Lift</h2>
            <Link href="/bills" className="small">
              See all →
            </Link>
          </div>
          {bills.length ? (
            <div className="grid">
              {bills.map((b) => (
                <BillCard key={b.id} bill={b} />
              ))}
            </div>
          ) : (
            <p className="muted">Every verified bill has been lifted. Check back soon.</p>
          )}
        </div>
      </section>

      <section className="section" style={{ background: "var(--surface-2)" }}>
        <div className="container">
          <p className="eyebrow">The Luminaries</p>
          <h2>The world&apos;s greatest givers, celebrated here</h2>
          <p className="muted narrow">
            Every person on the public billionaire lists has a reserved seat. When they Lift, the whole world sees it: verified, sourced and
            celebrated. {board.reserved.length} seats are still waiting for a first Lift.
          </p>
          {spotlight.length ? (
            <div className="grid">
              {spotlight.map((l) => (
                <Link key={l.id} href={`/honor-roll/luminaries/${l.slug}`} className="card luminary lit bill-card">
                  <span className="halo" aria-hidden="true" />
                  <span className="badge gold">{l.tier.label}</span>
                  <h3>{l.name}</h3>
                  <div className="bill-amount">{formatUSD(l.paidCents)}</div>
                  <div className="muted small">{l.households.toLocaleString()} households lifted through Lifted</div>
                </Link>
              ))}
            </div>
          ) : null}
          <p style={{ marginTop: 20 }}>
            <Link className="btn" href="/honor-roll#luminaries">
              Visit the Luminaries
            </Link>
          </p>
        </div>
      </section>

      {paid.length ? (
        <section className="section">
          <div className="container">
            <h2>Recently lifted</h2>
            <div className="grid">
              {paid.map((b) => (
                <BillCard key={b.id} bill={b} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
