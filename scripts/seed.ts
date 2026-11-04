/**
 * Development seed. Every person, biller and bill here is FICTIONAL.
 * Real Luminaries are loaded from a sourced CSV via `npm run db:import-luminaries`.
 */
import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { embedFields } from "@/lib/dedupe";
import { DEMO_ACCOUNTS } from "@/lib/demo";
import { computeFees } from "@/lib/fees";
import { tokenize } from "@/lib/security/vault";

const d = db();
const DAY = 86_400_000;
const isoIn = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
const ago = (days: number) => new Date(Date.now() - days * DAY);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed production");
  console.log("Resetting dev data…");
  await d.execute(sql`truncate table votes, contributions, payouts, processed_events, profile_claims, bills, luminaries, sessions, passkeys, auth_challenges, billers, vault_entries, audit_log, users restart identity cascade`);

  const billers = await d
    .insert(schema.billers)
    .values(
      (
        [
          ["Riverside Electric Co-op", "utility"],
          ["Metro Water Authority", "utility"],
          ["Northwind Gas & Heat", "utility"],
          ["Lakeview Property Management", "rent"],
          ["Cedar Grove Apartments", "rent"],
          ["Mercy Valley Community Hospital", "medical"],
          ["Bright Path Pediatrics", "medical"],
          ["Little Sprouts Childcare", "childcare"],
          ["CityLink Broadband", "internet"],
        ] as const
      ).map(([name, category]) => ({ name, normalizedName: norm(name), category, partnerBillerId: `mock_${norm(name).slice(0, 12)}` })),
    )
    .returning();
  const biller = (name: string) => billers.find((b) => b.name === name)!;

  const [donor, poster, reviewer, luminaryOffice] = await d
    .insert(schema.users)
    .values([
      { id: DEMO_ACCOUNTS.donor.id, displayName: "Jordan (demo donor)", city: "Columbus", showOnHonorRoll: true, verifiedAt: new Date() },
      { id: DEMO_ACCOUNTS.poster.id, displayName: "Sam (demo poster)", city: "Dayton", verifiedAt: new Date() },
      { id: DEMO_ACCOUNTS.reviewer.id, displayName: "Riley (reviewer)", role: "reviewer", verifiedAt: new Date() },
      { id: DEMO_ACCOUNTS.luminary.id, displayName: "Office of Avery Castellane", verifiedAt: new Date() },
    ])
    .returning();

  const givers = await d
    .insert(schema.users)
    .values(
      [
        ["Maya R.", "Toledo"],
        ["The Okafor Family", "Akron"],
        ["Dev P.", "Cleveland"],
        ["Second Street Bakery", "Cincinnati"],
        ["Lena & Chris", "Columbus"],
        ["Mutual Aid Northside", "Pittsburgh"],
        ["Tomás G.", "Detroit"],
        ["Priya S.", "Chicago"],
      ].map(([displayName, city]) => ({ displayName: displayName!, city, showOnHonorRoll: true, verifiedAt: ago(60) })),
    )
    .returning();

  // Luminaries: fictional sample seats, clearly labelled.
  const sampleList = { listSource: "Sample data (replace with a sourced list)", listSourceUrl: "https://example.org/sample-billionaire-list" };
  const lumRows = [
    ["avery-castellane", "Avery Castellane", "Founded a rural broadband foundation (sample)"],
    ["morgan-whitfield", "Morgan Whitfield", "Major donor to public libraries (sample)"],
    ["harper-lindqvist", "Harper Lindqvist", "Funds scholarships for first-generation students (sample)"],
    ["kenji-arceneaux", "Kenji Arceneaux", null],
    ["sloane-adebayo", "Sloane Adebayo", "Signed a public pledge to give away most of their wealth (sample)"],
    ["rowan-petrakis", "Rowan Petrakis", null],
    ["imani-castellanos", "Imani Castellanos", "Endowed a children's hospital wing (sample)"],
    ["theo-vanderhoek", "Theo Vanderhoek", null],
    ["celeste-moreau", "Celeste Moreau", "Climate research grants (sample)"],
    ["dashiell-okonkwo", "Dashiell Okonkwo", null],
    ["wren-halvorsen", "Wren Halvorsen", "Food bank network funding (sample)"],
    ["lucian-ferreira", "Lucian Ferreira", null],
  ] as const;
  await d.insert(schema.luminaries).values(
    lumRows.map(([slug, name, knownGiving]) => ({
      slug,
      name,
      ...sampleList,
      knownGiving,
      knownGivingSourceUrl: knownGiving ? "https://example.org/sample-source" : null,
      ...(slug === "avery-castellane"
        ? { userId: luminaryOffice!.id, claimedAt: ago(10), statement: "Nobody should lose heat or a home over one bad month. Proud to Lift alongside everyone here." }
        : {}),
    })),
  );

  type Seed = {
    biller: string;
    amount: number;
    due: number;
    story?: string;
    first?: string;
    city?: string;
    anon?: boolean;
    votes?: number;
    status: "live" | "paid" | "pending_review";
    funded?: [number, number][]; // [giverIndex (-1 = demo donor, -2 = luminary office), cents]
    publishedDaysAgo?: number;
    flags?: string[];
  };
  const seeds: Seed[] = [
    { biller: "Riverside Electric Co-op", amount: 18740, due: 3, story: "Shutoff notice after my hours got cut. Two kids, and it's getting cold.", first: "Dana", city: "Dayton", votes: 41, status: "live", publishedDaysAgo: 4, funded: [[0, 5000]] },
    { biller: "Lakeview Property Management", amount: 145000, due: 9, story: "Back on my feet after surgery, just need to close the gap on one month of rent.", first: "Marcus", city: "Toledo", votes: 88, status: "live", publishedDaysAgo: 6, funded: [[1, 40000], [2, 25000]] },
    { biller: "Mercy Valley Community Hospital", amount: 62000, due: 21, story: "ER visit for my daughter's asthma attack. We're paying what we can.", anon: true, votes: 23, status: "live", publishedDaysAgo: 2 },
    { biller: "Little Sprouts Childcare", amount: 42500, due: 6, story: "Childcare is what lets me keep working night shifts.", first: "Alicia", city: "Akron", votes: 57, status: "live", publishedDaysAgo: 9, funded: [[3, 30000]] },
    { biller: "Metro Water Authority", amount: 9630, due: -1, first: "Ed", city: "Flint", votes: 12, status: "live", publishedDaysAgo: 12 },
    { biller: "CityLink Broadband", amount: 7999, due: 14, story: "My son needs internet for school. Lost my job in March.", first: "Rosa", city: "Cleveland", votes: 9, status: "live", publishedDaysAgo: 1 },
    { biller: "Northwind Gas & Heat", amount: 23415, due: 11, anon: true, votes: 31, status: "live", publishedDaysAgo: 5, funded: [[4, 10000]] },
    { biller: "Cedar Grove Apartments", amount: 98000, due: 17, story: "Caring for my mom full time this month.", first: "Kevin", city: "Columbus", votes: 64, status: "live", publishedDaysAgo: 8 },
    { biller: "Bright Path Pediatrics", amount: 31000, due: 25, first: "Nia", city: "Cincinnati", votes: 4, status: "live", publishedDaysAgo: 0 },
    // Already lifted
    { biller: "Riverside Electric Co-op", amount: 21200, due: -5, story: "Lights back on. Thank you all.", first: "Grace", city: "Lima", votes: 70, status: "paid", publishedDaysAgo: 20, funded: [[-2, 21200]] },
    { biller: "Lakeview Property Management", amount: 120000, due: -3, first: "Andre", city: "Dayton", votes: 102, status: "paid", publishedDaysAgo: 18, funded: [[-2, 120000]] },
    { biller: "Metro Water Authority", amount: 15400, due: -8, anon: true, votes: 33, status: "paid", publishedDaysAgo: 25, funded: [[-1, 8000], [5, 7400]] },
    { biller: "Northwind Gas & Heat", amount: 28800, due: -10, first: "Lou", city: "Erie", votes: 45, status: "paid", publishedDaysAgo: 30, funded: [[6, 14400], [7, 14400]] },
    { biller: "Mercy Valley Community Hospital", amount: 54000, due: -12, first: "Bea", city: "Gary", votes: 51, status: "paid", publishedDaysAgo: 28, funded: [[-2, 54000]] },
    // Awaiting verification (visible in /review)
    { biller: "Sunrise Urgent Care", amount: 135000, due: 15, story: "Call me at 555-201-3344 if you can help", first: "Tess", city: "Canton", status: "pending_review", flags: ["biller_not_in_directory", "over_human_review_threshold", "story_pii_redacted"] },
    { biller: "CityLink Broadband", amount: 6500, due: 10, first: "Omar", city: "Youngstown", status: "pending_review", flags: [] },
  ];

  const who = (i: number) => (i === -1 ? donor! : i === -2 ? luminaryOffice! : givers[i]!);
  let n = 0;
  for (const s of seeds) {
    n++;
    const b = billers.find((x) => x.name === s.biller);
    const { token, last4 } = await tokenize(`${1000_0000 + n * 7919}`, "biller_account");
    const funded = (s.funded ?? []).reduce((a, [, c]) => a + c, 0);
    const story = s.story?.replace(/\b\d{3}-\d{3}-\d{4}\b/g, "[phone]") ?? null;
    const [bill] = await d
      .insert(schema.bills)
      .values({
        posterId: poster!.id,
        billerId: b?.id,
        billerName: b?.name ?? s.biller,
        category: b?.category ?? "medical",
        amountCents: s.amount,
        dueDate: isoIn(s.due),
        story,
        posterFirstName: s.anon ? null : (s.first ?? null),
        posterCity: s.anon ? null : (s.city ?? null),
        anonymous: !!s.anon,
        accountToken: token,
        accountLast4: last4,
        status: s.status,
        fundedCents: funded,
        voteCount: s.votes ?? 0,
        flags: s.flags ?? [],
        fingerprint: embedFields({ billerName: s.biller, amountCents: s.amount, dueDate: isoIn(s.due), accountLast4: last4 }),
        publishedAt: s.status === "pending_review" ? null : ago(s.publishedDaysAgo ?? 1),
        paidAt: s.status === "paid" ? ago(Math.max(0, (s.publishedDaysAgo ?? 3) - 3)) : null,
        reviewedBy: s.status === "pending_review" ? null : reviewer!.id,
        thankYou: s.status === "paid" && s.first === "Grace" ? "My kids did homework by lamplight for a week. Thank you for turning the lights back on." : null,
        createdAt: ago((s.publishedDaysAgo ?? 0) + 2),
      })
      .returning();
    for (const [gi, cents] of s.funded ?? []) {
      await d.insert(schema.contributions).values({
        billId: bill!.id,
        donorId: who(gi).id,
        ...computeFees(cents),
        status: "succeeded",
        succeededAt: ago(Math.max(0, (s.publishedDaysAgo ?? 1) - 1)),
      });
    }
    if (s.status === "paid") {
      await d.insert(schema.payouts).values({ billId: bill!.id, partnerRef: `mock_seed_${n}`, amountCents: s.amount, status: "confirmed", resolvedAt: new Date() });
    }
  }
  void biller;
  console.log(`Seeded ${billers.length} billers, ${seeds.length} bills, ${lumRows.length} sample Luminaries, ${givers.length + 4} users.`);
  console.log("Demo sign-in: /signin → Demo accounts (ALLOW_DEMO_LOGIN=true).");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
