/**
 * Import the Luminaries board from a sourced CSV.
 *
 *   npm run db:import-luminaries -- data/luminaries.csv
 *
 * Columns (header row required):
 *   name,list_source,list_source_url,known_giving,known_giving_source_url
 *
 * Rules (from the legal review in the spec): names only, every row must cite
 * the public list it came from, and any "known giving" claim must carry its
 * own source URL. Rows that break these rules are rejected, not imported.
 */
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { db, schema } from "@/lib/db";

const row = z
  .object({
    name: z.string().trim().min(2).max(120),
    list_source: z.string().trim().min(2).max(120),
    list_source_url: z.url().startsWith("https://"),
    known_giving: z.string().trim().max(300).optional().default(""),
    known_giving_source_url: z.string().trim().optional().default(""),
  })
  .refine((r) => !r.known_giving || /^https:\/\//.test(r.known_giving_source_url), {
    message: "known_giving requires an https known_giving_source_url",
  });

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let cur: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") cur.push(field), (field = "");
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cur.push(field), rows.push(cur), (cur = []), (field = "");
    } else field += ch;
  }
  if (field || cur.length) cur.push(field), rows.push(cur);
  return rows.filter((r) => r.some((c) => c.trim()));
}

const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npm run db:import-luminaries -- <file.csv>");
  const [header, ...lines] = parseCsv(await readFile(file, "utf8"));
  if (!header) throw new Error("Empty CSV");
  let ok = 0;
  const errors: string[] = [];
  for (const [i, line] of lines.entries()) {
    const parsed = row.safeParse(Object.fromEntries(header.map((h, j) => [h.trim(), line[j] ?? ""])));
    if (!parsed.success) {
      errors.push(`line ${i + 2}: ${parsed.error.issues[0]?.message}`);
      continue;
    }
    const r = parsed.data;
    await db()
      .insert(schema.luminaries)
      .values({
        slug: slugify(r.name),
        name: r.name,
        listSource: r.list_source,
        listSourceUrl: r.list_source_url,
        knownGiving: r.known_giving || null,
        knownGivingSourceUrl: r.known_giving_source_url || null,
      })
      .onConflictDoUpdate({
        target: schema.luminaries.slug,
        set: {
          listSource: r.list_source,
          listSourceUrl: r.list_source_url,
          knownGiving: r.known_giving || null,
          knownGivingSourceUrl: r.known_giving_source_url || null,
        },
      });
    ok++;
  }
  console.log(`Imported ${ok} Luminaries.`);
  if (errors.length) console.warn(`Rejected ${errors.length} rows:\n${errors.join("\n")}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
