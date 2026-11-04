"use client";
import { useState } from "react";
import { CATEGORIES, CATEGORY_LABELS, MAX_BILL_CENTS, STORY_MAX, type Category } from "@/lib/validation";
import { postJson } from "./api";

interface Extracted {
  billerName: string;
  category: Category;
  amountCents: number;
  dueDate: string;
}

export function PostBillForm({ aiExtraction }: { aiExtraction: boolean }) {
  const [step, setStep] = useState<"upload" | "details" | "done">("upload");
  const [ticket, setTicket] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const [f, setF] = useState({
    billerName: "",
    category: "utility" as Category,
    amount: "",
    dueDate: "",
    accountNumber: "",
    story: "",
    firstName: "",
    city: "",
    anonymous: false,
    legalName: "",
    address: "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body, credentials: "same-origin" });
      const data = (await res.json()) as { ticket?: string; fields?: Extracted | null; error?: string };
      if (!res.ok || !data.ticket) throw new Error(data.error ?? "Upload failed");
      setTicket(data.ticket);
      if (data.fields) {
        setPrefilled(true);
        setF((s) => ({
          ...s,
          billerName: data.fields!.billerName || s.billerName,
          category: data.fields!.category,
          amount: data.fields!.amountCents ? String(data.fields!.amountCents / 100) : s.amount,
          dueDate: data.fields!.dueDate || s.dueDate,
        }));
      }
      setStep("details");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (step === "done")
    return (
      <div className="notice ok" role="status">
        <strong>Your bill is in the verification queue.</strong> We confirm the balance with your biller and review it, usually within two
        business days. Your original upload is deleted as soon as it&apos;s verified.
      </div>
    );

  if (step === "upload")
    return (
      <div className="stack">
        <div className="dropzone">
          <p>
            <strong>Upload a photo or PDF of the bill</strong>
          </p>
          <p className="small muted">
            JPEG, PNG, WebP or PDF, up to 10 MB. Photos are re-rendered to strip hidden data like GPS location.
            {aiExtraction ? " We'll read the amount and due date for you to confirm." : ""}
          </p>
          <label className="btn" htmlFor="file" style={{ display: "inline-flex", marginBottom: 0 }}>
            {busy ? "Securing your upload…" : "Choose file"}
          </label>
          <input
            id="file"
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </div>
        {err ? (
          <p className="notice err" role="alert">
            {err}
          </p>
        ) : null}
      </div>
    );

  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await postJson("/api/bills", {
            billerName: f.billerName,
            category: f.category,
            amountCents: Math.round(Number(f.amount) * 100),
            dueDate: f.dueDate,
            accountNumber: f.accountNumber,
            story: f.story,
            firstName: f.firstName,
            city: f.city,
            anonymous: f.anonymous,
            legalName: f.legalName,
            address: f.address,
            uploadTicket: ticket,
          });
          setStep("done");
        } catch (e2) {
          setErr((e2 as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {prefilled ? <p className="notice small">We filled in what we could read. Please check every field.</p> : null}
      <h3>The bill</h3>
      <div className="field">
        <label htmlFor="biller">Who is the bill from?</label>
        <input id="biller" type="text" value={f.billerName} onChange={(e) => set("billerName", e.target.value)} required maxLength={120} placeholder="e.g. Riverside Electric" />
      </div>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="field" style={{ flex: "1 1 160px" }}>
          <label htmlFor="cat">Type</label>
          <select id="cat" value={f.category} onChange={(e) => set("category", e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: "1 1 140px" }}>
          <label htmlFor="amt">Amount due ($)</label>
          <input id="amt" type="number" min={10} max={MAX_BILL_CENTS / 100} step="0.01" value={f.amount} onChange={(e) => set("amount", e.target.value)} required />
        </div>
        <div className="field" style={{ flex: "1 1 160px" }}>
          <label htmlFor="due">Due date</label>
          <input id="due" type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} required />
        </div>
      </div>
      <div className="field">
        <label htmlFor="acct">
          Account number on the bill <span className="hint">(encrypted in a separate vault and only shared with the payment partner)</span>
        </label>
        <input id="acct" type="text" value={f.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} required autoComplete="off" />
      </div>

      <h3>Your story (optional)</h3>
      <div className="field">
        <label htmlFor="story">
          A few words for givers <span className="hint">({STORY_MAX - f.story.length} left · reviewed before publishing)</span>
        </label>
        <textarea id="story" maxLength={STORY_MAX} value={f.story} onChange={(e) => set("story", e.target.value)} />
      </div>
      <label className="checkbox field">
        <input type="checkbox" checked={f.anonymous} onChange={(e) => set("anonymous", e.target.checked)} />
        <span>Stay fully anonymous (shown as &ldquo;A neighbor&rdquo;)</span>
      </label>
      {!f.anonymous ? (
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div className="field" style={{ flex: "1 1 200px" }}>
            <label htmlFor="fn">First name (public)</label>
            <input id="fn" type="text" value={f.firstName} onChange={(e) => set("firstName", e.target.value)} maxLength={40} />
          </div>
          <div className="field" style={{ flex: "1 1 200px" }}>
            <label htmlFor="city">City (public)</label>
            <input id="city" type="text" value={f.city} onChange={(e) => set("city", e.target.value)} maxLength={60} />
          </div>
        </div>
      ) : null}

      <h3>Private verification details</h3>
      <p className="small muted">Never shown publicly. Encrypted at rest and used only to confirm the bill is yours.</p>
      <div className="field">
        <label htmlFor="ln">Legal name (as on the bill)</label>
        <input id="ln" type="text" value={f.legalName} onChange={(e) => set("legalName", e.target.value)} required maxLength={120} autoComplete="name" />
      </div>
      <div className="field">
        <label htmlFor="addr">Service address</label>
        <input id="addr" type="text" value={f.address} onChange={(e) => set("address", e.target.value)} required maxLength={240} autoComplete="street-address" />
      </div>
      {err ? (
        <p className="notice err" role="alert">
          {err}
        </p>
      ) : null}
      <button className="btn gold block" disabled={busy}>
        {busy ? "Submitting securely…" : "Submit for verification"}
      </button>
    </form>
  );
}
