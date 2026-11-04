"use client";
import { useState } from "react";
import { postJson } from "./api";

export function ThankYouForm({ billId }: { billId: string }) {
  const [msg, setMsg] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | string>("idle");
  if (state === "done") return <div className="notice ok">Thank-you posted. Your Lifters will see it.</div>;
  return (
    <form
      className="card flat"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        try {
          await postJson(`/api/bills/${billId}/thanks`, { message: msg });
          setState("done");
          window.location.reload();
        } catch (err) {
          setState((err as Error).message);
        }
      }}
    >
      <label htmlFor="ty">Say thank you to your Lifters</label>
      <textarea id="ty" maxLength={280} value={msg} onChange={(e) => setMsg(e.target.value)} required />
      <div className="row spread" style={{ marginTop: 8 }}>
        <span className="tiny">{280 - msg.length} characters left. Personal details are removed automatically.</span>
        <button className="btn sm" disabled={state === "busy"}>
          Post thank-you
        </button>
      </div>
      {state !== "idle" && state !== "busy" ? <p className="notice err small">{state}</p> : null}
    </form>
  );
}
