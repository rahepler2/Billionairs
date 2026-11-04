/**
 * Near-duplicate bill detection using feature-hashed character n-gram vectors
 * built from REDACTED fields only (biller, amount, due month, account last-4).
 * No raw PII ever enters a vector (spec: LLM pipeline security).
 *
 * This is deliberately dependency-free. To upgrade, swap `embedFields` for a
 * self-hosted embedding model and store vectors in pgvector; the call sites
 * only depend on `embedFields` + `cosine`.
 */
export const DIM = 256;
export const DUPLICATE_THRESHOLD = 0.92;

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface DedupeFields {
  billerName: string;
  amountCents: number;
  dueDate: string;
  accountLast4: string;
}

export function canonicalText(f: DedupeFields): string {
  const biller = f.billerName.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  return `${biller} | ${(f.amountCents / 100).toFixed(2)} | ${f.dueDate.slice(0, 7)} | ${f.accountLast4}`;
}

export function embedFields(f: DedupeFields): number[] {
  const text = canonicalText(f);
  const v = new Array<number>(DIM).fill(0);
  for (let n = 2; n <= 4; n++) {
    for (let i = 0; i + n <= text.length; i++) {
      const h = fnv1a(`${n}:${text.slice(i, i + n)}`);
      v[h % DIM]! += h & 0x80000000 ? -1 : 1;
    }
  }
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) dot += a[i]! * b[i]!;
  return dot;
}
