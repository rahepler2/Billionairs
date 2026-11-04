"use client";
import Link from "next/link";
import { useState } from "react";
import { postJson } from "./api";

export function VoteButton({ billId, initialVotes, hasVoted, signedIn }: { billId: string; initialVotes: number; hasVoted: boolean; signedIn: boolean }) {
  const [votes, setVotes] = useState(initialVotes);
  const [voted, setVoted] = useState(hasVoted);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!signedIn)
    return (
      <p className="small">
        ▲ {votes} backers · <Link href="/signin">Sign in to back this bill</Link>
      </p>
    );

  return (
    <div className="row">
      <button
        className={`btn ${voted ? "ghost" : ""}`}
        disabled={voted || busy}
        aria-pressed={voted}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const r = await postJson<{ voteCount: number; remaining: number }>(`/api/bills/${billId}/vote`);
            setVotes(r.voteCount);
            setVoted(true);
            setMsg(`Backed. ${r.remaining} votes left today.`);
          } catch (e) {
            setMsg((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        ▲ {voted ? "Backed" : "Back this bill"} · {votes}
      </button>
      {msg ? (
        <span className="small muted" role="status">
          {msg}
        </span>
      ) : null}
    </div>
  );
}
