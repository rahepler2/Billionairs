import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { DUPLICATE_THRESHOLD, cosine, embedFields } from "@/lib/dedupe";
import { HttpError, assertSameOrigin, clientIp, handler, parseJson, rateLimit, requireUser } from "@/lib/http";
import { redactPII } from "@/lib/redact";
import { audit } from "@/lib/security/audit";
import { seal } from "@/lib/security/crypto";
import { dataKeys } from "@/lib/security/keys";
import { tokenize } from "@/lib/security/vault";
import { UPLOAD_TTL_MS } from "@/lib/security/uploads";
import { openTicket } from "@/lib/uploadTicket";
import { HUMAN_REVIEW_OVER_CENTS, MAX_ACTIVE_BILLS, billFieldsSchema } from "@/lib/validation";

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireUser();
  rateLimit("post", user.id, clientIp(req));
  const f = await parseJson(req, billFieldsSchema);

  const [active] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.bills)
    .where(and(eq(schema.bills.posterId, user.id), inArray(schema.bills.status, ["pending_review", "live", "funded"])));
  if ((active?.n ?? 0) >= MAX_ACTIVE_BILLS) throw new HttpError(409, "You already have an active bill. You can post another once it's resolved.");

  const ticket = f.uploadTicket ? openTicket(user.id, f.uploadTicket) : null;
  if (!ticket) throw new HttpError(400, "Please upload a photo or PDF of the bill first");
  const flags = new Set(ticket.flags);

  const [biller] = await db().select().from(schema.billers).where(eq(schema.billers.normalizedName, normalize(f.billerName)));
  if (!biller) flags.add("biller_not_in_directory");
  if (f.amountCents > HUMAN_REVIEW_OVER_CENTS) flags.add("over_human_review_threshold");

  const story = f.story ? redactPII(f.story) : null;
  if (story && story !== f.story) flags.add("story_pii_redacted");

  const { token, last4 } = await tokenize(f.accountNumber, "biller_account");
  const fingerprint = embedFields({ billerName: f.billerName, amountCents: f.amountCents, dueDate: f.dueDate, accountLast4: last4 });
  const recent = await db()
    .select({ id: schema.bills.id, fingerprint: schema.bills.fingerprint })
    .from(schema.bills)
    .where(gt(schema.bills.createdAt, new Date(Date.now() - 180 * 86_400_000)))
    .limit(5000);
  if (recent.some((r) => cosine(r.fingerprint, fingerprint) >= DUPLICATE_THRESHOLD)) flags.add("possible_duplicate");

  const keys = dataKeys();
  await db()
    .update(schema.users)
    .set({
      legalNameEnc: seal(keys, f.legalName, `user:${user.id}:legal_name`),
      addressEnc: seal(keys, f.address, `user:${user.id}:address`),
      city: f.city || user.city,
    })
    .where(eq(schema.users.id, user.id));

  const [bill] = await db()
    .insert(schema.bills)
    .values({
      posterId: user.id,
      billerId: biller?.id,
      billerName: biller?.name ?? f.billerName,
      category: biller?.category ?? f.category,
      amountCents: f.amountCents,
      dueDate: f.dueDate,
      story,
      posterFirstName: f.anonymous ? null : f.firstName || null,
      posterCity: f.anonymous ? null : f.city || null,
      anonymous: f.anonymous,
      accountToken: token,
      accountLast4: last4,
      flags: [...flags],
      fingerprint,
      uploadKey: ticket.key,
      uploadPurgeAfter: new Date(Date.now() + UPLOAD_TTL_MS),
      extractedBy: ticket.extractedBy,
    })
    .returning({ id: schema.bills.id });

  await audit("bill.submitted", { actorId: user.id, target: bill!.id, meta: { flags: [...flags] } });
  return NextResponse.json({ id: bill!.id }, { status: 201 });
});
