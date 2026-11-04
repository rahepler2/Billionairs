/**
 * Feed ranking. Blends community votes, urgency (days until due) and time
 * waiting, so popular stories don't crowd out quieter needs (spec §3 Vote).
 * Votes are log-damped: the 100th vote matters far less than the 1st.
 */
export interface RankInput {
  voteCount: number;
  dueDate: string; // YYYY-MM-DD
  publishedAt: Date;
  fundedCents: number;
  amountCents: number;
}

export const RANK_WEIGHTS = { votes: 1.0, urgency: 1.6, waiting: 0.9 } as const;

const DAY = 86_400_000;

export function urgencyScore(dueDate: string, now: Date): number {
  const days = (Date.parse(`${dueDate}T23:59:59Z`) - now.getTime()) / DAY;
  if (days <= 0) return 1; // past due: maximum urgency (shutoff risk)
  return 1 / (1 + days / 7); // ~0.5 one week out, ~0.19 a month out
}

export function waitingScore(publishedAt: Date, now: Date): number {
  const days = Math.max(0, (now.getTime() - publishedAt.getTime()) / DAY);
  return Math.min(1, days / 14); // saturates after two weeks waiting
}

export function voteScore(votes: number): number {
  return Math.log1p(Math.max(0, votes)) / Math.log1p(250); // ~1.0 at 250 votes
}

export function rankScore(b: RankInput, now = new Date()): number {
  const remaining = Math.max(0, b.amountCents - b.fundedCents) / Math.max(1, b.amountCents);
  const base =
    RANK_WEIGHTS.votes * voteScore(b.voteCount) +
    RANK_WEIGHTS.urgency * urgencyScore(b.dueDate, now) +
    RANK_WEIGHTS.waiting * waitingScore(b.publishedAt, now);
  // Nearly-funded bills get a small nudge so they cross the line.
  const closer = remaining > 0 && remaining < 0.2 ? 0.25 : 0;
  return Number((base + closer).toFixed(6));
}

export function rankBills<T extends RankInput>(bills: T[], now = new Date()): T[] {
  return [...bills].sort((a, b) => rankScore(b, now) - rankScore(a, now));
}
