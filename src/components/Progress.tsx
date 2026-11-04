import { formatUSD } from "@/lib/fees";

export function Progress({ funded, total }: { funded: number; total: number }) {
  const pct = Math.min(100, Math.round((funded / Math.max(1, total)) * 100));
  return (
    <div>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Funded">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="tiny" style={{ marginTop: 4 }}>
        {formatUSD(funded)} of {formatUSD(total)} lifted · {pct}%
      </div>
    </div>
  );
}
