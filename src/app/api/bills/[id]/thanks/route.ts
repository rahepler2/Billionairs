import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { HttpError, assertSameOrigin, handler, parseJson, requireUser } from "@/lib/http";
import { redactPII } from "@/lib/redact";
import { STORY_MAX } from "@/lib/validation";

export const POST = handler<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await params;
  const { message } = await parseJson(req, z.object({ message: z.string().trim().min(2).max(STORY_MAX).refine((s) => !/[<>]/.test(s)) }));
  const rows = await db()
    .update(schema.bills)
    .set({ thankYou: redactPII(message) })
    .where(and(eq(schema.bills.id, id), eq(schema.bills.posterId, user.id), eq(schema.bills.status, "paid")))
    .returning({ id: schema.bills.id });
  if (!rows.length) throw new HttpError(404, "You can post a thank-you once your bill is paid");
  return NextResponse.json({ ok: true });
});
