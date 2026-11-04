import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClaimForm } from "@/components/ClaimForm";
import { currentUser } from "@/lib/auth/session";
import { formatUSD } from "@/lib/fees";
import { luminaryBoard } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const board = await luminaryBoard();
  const l = [...board.lit, ...board.reserved].find((x) => x.slug === slug);
  return l ? { title: l.name } : {};
}

export default async function LuminaryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [board, user] = await Promise.all([luminaryBoard(), currentUser()]);
  const l = [...board.lit, ...board.reserved].find((x) => x.slug === slug);
  if (!l) notFound();
  const lit = l.paidCents > 0;

  return (
    <div className="container section narrow stack">
      <p className="small">
        <Link href="/honor-roll#luminaries">← The Luminaries</Link>
      </p>
      <div className={`card luminary ${lit ? "lit" : "seat"}`}>
        <span className="halo" aria-hidden="true" />
        <div className="row">
          <span className={`badge ${lit ? "gold" : ""}`}>{lit ? `#${l.rank} · ${l.tier.label}` : "Seat reserved"}</span>
          {l.claimedAt ? <span className="badge verified">✓ Profile claimed</span> : null}
        </div>
        <h1>{l.name}</h1>
        {lit ? (
          <>
            <div className="bill-amount">{formatUSD(l.paidCents)} paid to billers</div>
            <p className="muted">
              {l.households.toLocaleString()} households lifted through Lifted · {l.points.toLocaleString()} impact points. {l.tier.blurb}
            </p>
          </>
        ) : (
          <p className="muted">
            A seat at the table, waiting for a first Lift. Paid through Lifted so far: {formatUSD(0)}. This reflects only giving through
            Lifted, not their philanthropy anywhere else.
          </p>
        )}
        {l.statement ? <p className="story">“{l.statement}”</p> : null}
      </div>

      <div className="card flat">
        <h3>Philanthropy beyond Lifted</h3>
        {l.knownGiving ? (
          <p>
            {l.knownGiving}{" "}
            {l.knownGivingSourceUrl ? (
              <a href={l.knownGivingSourceUrl} rel="noopener noreferrer nofollow" target="_blank">
                Source
              </a>
            ) : null}
          </p>
        ) : (
          <p className="muted">No publicly documented philanthropy on file yet. Offices can send sourced corrections at any time.</p>
        )}
        <p className="tiny">
          Listed from{" "}
          <a href={l.listSourceUrl} rel="noopener noreferrer nofollow" target="_blank">
            {l.listSource}
          </a>
          . Name only; no endorsement implied. <Link href="/methodology">Methodology &amp; corrections</Link>
        </p>
      </div>

      {!l.userId ? (
        <div className="card flat">
          <h3>Is this you, or your office?</h3>
          <p className="muted small">
            Claim this seat to link Lifts, add a statement, or show foundation giving. We verify every claim directly with the
            person&apos;s office before anything changes.
          </p>
          {user ? <ClaimForm slug={l.slug} /> : <Link className="btn" href="/signin">Sign in to claim</Link>}
        </div>
      ) : null}
    </div>
  );
}
