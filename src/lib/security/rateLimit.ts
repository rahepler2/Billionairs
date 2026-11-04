/**
 * Sliding-window rate limiter. In-memory for a single instance; in production
 * back this with Redis (same interface) and enforce coarse limits at the WAF.
 */
export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export class SlidingWindowLimiter {
  readonly #hits = new Map<string, number[]>();
  constructor(
    readonly limit: number,
    readonly windowMs: number,
  ) {}

  check(key: string, now = Date.now()): RateLimitResult {
    const cutoff = now - this.windowMs;
    const hits = (this.#hits.get(key) ?? []).filter((t) => t > cutoff);
    if (hits.length >= this.limit) {
      this.#hits.set(key, hits);
      return { ok: false, remaining: 0, retryAfterSec: Math.ceil((hits[0]! + this.windowMs - now) / 1000) };
    }
    hits.push(now);
    this.#hits.set(key, hits);
    if (this.#hits.size > 50_000) this.#sweep(cutoff);
    return { ok: true, remaining: this.limit - hits.length, retryAfterSec: 0 };
  }

  #sweep(cutoff: number) {
    for (const [k, v] of this.#hits) if (!v.some((t) => t > cutoff)) this.#hits.delete(k);
  }
}

const g = globalThis as unknown as { __liftedLimiters?: Map<string, SlidingWindowLimiter> };
const registry = (g.__liftedLimiters ??= new Map());

/** Named limiters per write endpoint. */
export const LIMITS = {
  auth: [10, 60_000],
  post: [5, 3_600_000],
  vote: [60, 3_600_000],
  checkout: [20, 3_600_000],
  claim: [3, 86_400_000],
  review: [300, 3_600_000],
} as const satisfies Record<string, readonly [number, number]>;

export function limiter(name: keyof typeof LIMITS): SlidingWindowLimiter {
  let l = registry.get(name);
  if (!l) {
    const [limit, windowMs] = LIMITS[name];
    l = new SlidingWindowLimiter(limit, windowMs);
    registry.set(name, l);
  }
  return l;
}
