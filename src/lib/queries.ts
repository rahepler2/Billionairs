import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { rankBills, rankScore } from "@/lib/ranking";
import { rankGivers, tierFor } from "@/lib/honor";
import type { Category } from "@/lib/validation";

/**
 * Read models for public pages. Public projections never include account
 * tokens, legal names, addresses, uploads, or review notes.
 */
export interface PublicBill {
  id: string;
  billerName: string;
  category: Category;
  amountCents: number;
  fundedCents: number;
  dueDate: string;
  story: string | null;
  attribution: string;
  voteCount: number;
  status: "live" | "funded" | "paid";
  publishedAt: Date;
  paidAt: Date | null;
  thankYou: string | null;
  score?: number;
}

type BillRow = typeof schema.bills.$inferSelect;

export function toPublic(b: BillRow): PublicBill {
  const who = b.anonymous || !b.posterFirstName ? "A neighbor" : b.posterFirstName;
  return {
    id: b.id,
    billerName: b.billerName,
    category: b.category,
    amountCents: b.amountCents,
    fundedCents: b.fundedCents,
    dueDate: b.dueDate,
    story: b.story,
    attribution: b.posterCity && !b.anonymous ? `${who} in ${b.posterCity}` : who,
    voteCount: b.voteCount,
    status: b.status as PublicBill["status"],
    publishedAt: b.publishedAt ?? b.createdAt,
    paidAt: b.paidAt,
    thankYou: b.thankYou,
  };
}

const PUBLIC_STATUSES = ["live", "funded", "paid"] as const;

export async function liveBills(limit = 60): Promise<PublicBill[]> {
  const rows = await db().select().from(schema.bills).where(eq(schema.bills.status, "live")).limit(500);
  const now = new Date();
  return rankBills(rows.map(toPublic), now)
    .slice(0, limit)
    .map((b) => ({ ...b, score: rankScore(b, now) }));
}

export async function recentlyPaid(limit = 6): Promise<PublicBill[]> {
  const rows = await db().select().from(schema.bills).where(eq(schema.bills.status, "paid")).orderBy(desc(schema.bills.paidAt)).limit(limit);
  return rows.map(toPublic);
}

export async function publicBill(id: string): Promise<PublicBill | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db()
    .select()
    .from(schema.bills)
    .where(and(eq(schema.bills.id, id), inArray(schema.bills.status, [...PUBLIC_STATUSES])));
  return row ? toPublic(row) : null;
}

export async function billLifters(billId: string) {
  return db()
    .select({
      amountCents: schema.contributions.amountCents,
      anonymous: schema.contributions.anonymous,
      name: schema.users.displayName,
      public: schema.users.showOnHonorRoll,
      at: schema.contributions.succeededAt,
    })
    .from(schema.contributions)
    .leftJoin(schema.users, eq(schema.users.id, schema.contributions.donorId))
    .where(and(eq(schema.contributions.billId, billId), eq(schema.contributions.status, "succeeded")))
    .orderBy(desc(schema.contributions.succeededAt))
    .limit(50)
    .then((rows) => rows.map((r) => ({ amountCents: r.amountCents, at: r.at, name: r.anonymous || !r.public ? "Anonymous" : (r.name ?? "Anonymous") })));
}

export async function platformStats() {
  const [paid] = await db()
    .select({ cents: sql<number>`coalesce(sum(${schema.bills.amountCents}),0)::int`, count: sql<number>`count(*)::int` })
    .from(schema.bills)
    .where(eq(schema.bills.status, "paid"));
  const [givers] = await db()
    .select({ count: sql<number>`count(distinct ${schema.contributions.donorId})::int` })
    .from(schema.contributions)
    .where(eq(schema.contributions.status, "succeeded"));
  const [live] = await db().select({ count: sql<number>`count(*)::int` }).from(schema.bills).where(eq(schema.bills.status, "live"));
  return { paidCents: paid?.cents ?? 0, householdsLifted: paid?.count ?? 0, givers: givers?.count ?? 0, liveBills: live?.count ?? 0 };
}

/** Per-donor verified totals (succeeded contributions only). */
async function giverTotals() {
  return db()
    .select({
      userId: schema.contributions.donorId,
      paidCents: sql<number>`sum(${schema.contributions.amountCents})::int`,
      households: sql<number>`count(distinct ${schema.contributions.billId})::int`,
    })
    .from(schema.contributions)
    .where(and(eq(schema.contributions.status, "succeeded"), eq(schema.contributions.anonymous, false)))
    .groupBy(schema.contributions.donorId);
}

export async function honorRoll(limit = 100) {
  const totals = await giverTotals();
  const ids = totals.map((t) => t.userId).filter((x): x is string => !!x);
  if (!ids.length) return [];
  const people = await db()
    .select({ id: schema.users.id, name: schema.users.displayName, city: schema.users.city, show: schema.users.showOnHonorRoll })
    .from(schema.users)
    .where(inArray(schema.users.id, ids));
  const luminaryUsers = new Set(
    (await db().select({ userId: schema.luminaries.userId }).from(schema.luminaries)).map((l) => l.userId).filter(Boolean),
  );
  const byId = new Map(people.map((p) => [p.id, p]));
  const rows = totals
    .filter((t) => t.userId && byId.get(t.userId)?.show && !luminaryUsers.has(t.userId))
    .map((t) => ({ name: byId.get(t.userId!)!.name, city: byId.get(t.userId!)!.city, paidCents: t.paidCents, households: t.households }));
  return rankGivers(rows)
    .slice(0, limit)
    .map((r) => ({ ...r, tier: tierFor(r.paidCents) }));
}

export async function luminaryBoard() {
  const lums = await db().select().from(schema.luminaries);
  const totals = new Map((await giverTotals()).map((t) => [t.userId, t]));
  const rows = lums.map((l) => {
    const t = l.userId ? totals.get(l.userId) : undefined;
    return { ...l, paidCents: t?.paidCents ?? 0, households: t?.households ?? 0 };
  });
  const ranked = rankGivers(rows).map((r) => ({ ...r, tier: tierFor(r.paidCents) }));
  const lit = ranked.filter((r) => r.paidCents > 0);
  const reserved = ranked.filter((r) => r.paidCents === 0).sort((a, b) => a.name.localeCompare(b.name));
  return { lit, reserved };
}

export async function luminaryBySlug(slug: string) {
  const [l] = await db().select().from(schema.luminaries).where(eq(schema.luminaries.slug, slug));
  return l ?? null;
}
