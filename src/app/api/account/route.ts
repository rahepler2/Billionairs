import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { assertSameOrigin, handler, parseJson, requireUser } from "@/lib/http";
import { audit } from "@/lib/security/audit";
import { displayNameSchema } from "@/lib/validation";

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const body = await parseJson(
    req,
    z.object({
      displayName: displayNameSchema,
      city: z.string().trim().max(60).refine((s) => !/[<>]/.test(s)).optional(),
      showOnHonorRoll: z.boolean(),
    }),
  );
  await db()
    .update(schema.users)
    .set({ displayName: body.displayName, city: body.city || null, showOnHonorRoll: body.showOnHonorRoll })
    .where(eq(schema.users.id, user.id));
  await audit("account.updated", { actorId: user.id, meta: { showOnHonorRoll: body.showOnHonorRoll } });
  return NextResponse.json({ ok: true });
});
