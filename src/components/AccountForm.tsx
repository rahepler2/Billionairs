"use client";
import { useState } from "react";
import { postJson } from "./api";

export function AccountForm(props: { displayName: string; city: string; showOnHonorRoll: boolean }) {
  const [f, setF] = useState(props);
  const [state, setState] = useState("idle");
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        try {
          await postJson("/api/account", f);
          setState("Saved.");
        } catch (err) {
          setState((err as Error).message);
        }
      }}
    >
      <h3>Honor Roll settings</h3>
      <div className="field">
        <label htmlFor="dn">Display name</label>
        <input id="dn" type="text" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} minLength={2} maxLength={40} required />
      </div>
      <div className="field">
        <label htmlFor="city">City (optional, shown under your name)</label>
        <input id="city" type="text" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} maxLength={60} />
      </div>
      <label className="checkbox field">
        <input type="checkbox" checked={f.showOnHonorRoll} onChange={(e) => setF({ ...f, showOnHonorRoll: e.target.checked })} />
        <span>Show me on the public Honor Roll. Off by default; anonymous Lifts never appear.</span>
      </label>
      <button className="btn" disabled={state === "busy"}>
        Save
      </button>
      {!["idle", "busy"].includes(state) ? (
        <p className={`notice small ${state === "Saved." ? "ok" : "err"}`} style={{ marginTop: 10 }}>
          {state}
        </p>
      ) : null}
    </form>
  );
}
