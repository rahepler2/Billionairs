/**
 * The Honor Roll. Generosity is celebrated, never shamed: everyone starts with
 * an open seat, and every verified dollar moves them up. Ranking weights
 * dollars AND households helped so splitting gifts into many tiny bills or
 * one giant bill can't game the board (spec §5 Anti-gaming).
 */
export interface GiverStats {
  paidCents: number;
  households: number;
}

export const POINTS_PER_DOLLAR = 1;
export const POINTS_PER_HOUSEHOLD = 50;

export function impactPoints({ paidCents, households }: GiverStats): number {
  return Math.round((paidCents / 100) * POINTS_PER_DOLLAR + households * POINTS_PER_HOUSEHOLD);
}

export interface Tier {
  key: "open" | "lifter" | "champion" | "patron" | "luminary";
  label: string;
  minCents: number;
  blurb: string;
}

export const TIERS: readonly Tier[] = [
  { key: "luminary", label: "Luminary", minCents: 25_000_000, blurb: "Lit up whole communities." },
  { key: "patron", label: "Patron", minCents: 2_500_000, blurb: "Kept the lights on for a neighborhood." },
  { key: "champion", label: "Champion", minCents: 100_000, blurb: "Carried families through a hard month." },
  { key: "lifter", label: "Lifter", minCents: 1, blurb: "Lifted a neighbor." },
  { key: "open", label: "Seat reserved", minCents: 0, blurb: "A seat at the table, waiting for a first Lift." },
] as const;

export function tierFor(paidCents: number): Tier {
  return TIERS.find((t) => paidCents >= t.minCents) ?? TIERS[TIERS.length - 1]!;
}

export function rankGivers<T extends GiverStats>(rows: T[]): (T & { points: number; rank: number })[] {
  return rows
    .map((r) => ({ ...r, points: impactPoints(r) }))
    .sort((a, b) => b.points - a.points || b.households - a.households)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
