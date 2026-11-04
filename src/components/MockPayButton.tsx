"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "./api";

export function MockPayButton({ cid }: { cid: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        className="btn gold block"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await postJson<{ billId: string }>(`/api/dev/checkout/${cid}`);
            router.push(`/bills/${r.billId}?lifted=1`);
            router.refresh();
          } catch (e) {
            setErr((e as Error).message);
            setBusy(false);
          }
        }}
      >
        Pay with test card
      </button>
      {err ? <p className="notice err small">{err}</p> : null}
    </>
  );
}
