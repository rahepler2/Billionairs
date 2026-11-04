"use client";
import { useState } from "react";
import { postJson } from "./api";

export function ClaimForm({ slug }: { slug: string }) {
  const [contact, setContact] = useState("");
  const [state, setState] = useState<string>("idle");
  if (state === "done") return <p className="notice ok">Thank you. Our team will verify with the office directly, usually within two business days.</p>;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        try {
          await postJson(`/api/luminaries/${slug}/claim`, { contact });
          setState("done");
        } catch (err) {
          setState((err as Error).message);
        }
      }}
    >
      <div className="field">
        <label htmlFor="contact">
          How can we verify with the office? <span className="hint">(official email domain, office phone, or representative)</span>
        </label>
        <textarea id="contact" value={contact} onChange={(e) => setContact(e.target.value)} required minLength={10} maxLength={500} />
      </div>
      <button className="btn" disabled={state === "busy"}>
        Request to claim this seat
      </button>
      {!["idle", "busy"].includes(state) ? <p className="notice err small">{state}</p> : null}
    </form>
  );
}
