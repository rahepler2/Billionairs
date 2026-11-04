"use client";
import { useState } from "react";
import { postJson } from "./api";

export function ReviewActions({ billId, hasStory }: { billId: string; hasStory: boolean }) {
  const [note, setNote] = useState("");
  const [publishStory, setPublishStory] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [state, setState] = useState<string>("idle");

  async function decide(decision: "approve" | "reject") {
    setState("busy");
    try {
      await postJson(`/api/review/${billId}`, { decision, note: note || undefined, publishStory });
      setState(decision === "approve" ? "Approved and live." : "Rejected.");
    } catch (e) {
      setState((e as Error).message);
    }
  }

  if (state.startsWith("Approved") || state === "Rejected.") return <p className="notice ok">{state}</p>;
  return (
    <div className="stack">
      <label className="checkbox small">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <span>I confirmed this balance with the biller (API, payment network, or phone).</span>
      </label>
      {hasStory ? (
        <label className="checkbox small">
          <input type="checkbox" checked={publishStory} onChange={(e) => setPublishStory(e.target.checked)} />
          <span>Story passes moderation and can be published</span>
        </label>
      ) : null}
      <input type="text" placeholder="Internal note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      <div className="row">
        <button className="btn lift" disabled={!confirmed || state === "busy"} onClick={() => decide("approve")}>
          Approve &amp; publish
        </button>
        <button className="btn danger" disabled={state === "busy"} onClick={() => decide("reject")}>
          Reject
        </button>
      </div>
      {!["idle", "busy"].includes(state) ? <p className="notice err small">{state}</p> : null}
    </div>
  );
}
