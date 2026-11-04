"use client";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "./api";

type Opts = { challengeId: string; options: Parameters<typeof startRegistration>[0]["optionsJSON"] };
type LoginOpts = { challengeId: string; options: Parameters<typeof startAuthentication>[0]["optionsJSON"] };

export function SignInPanel({ demoAccounts }: { demoAccounts: { key: string; label: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      router.push("/bills");
      router.refresh();
    } catch (e) {
      const m = (e as Error).message;
      setErr(/NotAllowed|abort|cancel/i.test(m) ? "Passkey prompt was cancelled." : m);
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <h3>I have an account</h3>
        <button
          className="btn block"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const { challengeId, options } = await postJson<LoginOpts>("/api/auth/login/options");
              const response = await startAuthentication({ optionsJSON: options });
              await postJson("/api/auth/login/verify", { challengeId, response });
            })
          }
        >
          Sign in with a passkey
        </button>
      </div>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const { challengeId, options } = await postJson<Opts>("/api/auth/register/options", { displayName: name });
            const response = await startRegistration({ optionsJSON: options });
            await postJson("/api/auth/register/verify", { challengeId, response });
          });
        }}
      >
        <h3>I&apos;m new here</h3>
        <div className="field">
          <label htmlFor="dn">
            Display name <span className="hint">(how you&apos;ll appear if you choose to join the Honor Roll)</span>
          </label>
          <input id="dn" type="text" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={40} required autoComplete="nickname" />
        </div>
        <button className="btn gold block" disabled={busy}>
          Create account with a passkey
        </button>
      </form>
      {err ? (
        <p className="notice err" role="alert">
          {err}
        </p>
      ) : null}
      {demoAccounts.length ? (
        <div className="card flat">
          <h3>Demo accounts</h3>
          <p className="tiny">Local development only. Disabled automatically in production.</p>
          <div className="row">
            {demoAccounts.map((a) => (
              <button key={a.key} className="btn ghost sm" disabled={busy} onClick={() => run(() => postJson("/api/auth/demo", { as: a.key }))}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
