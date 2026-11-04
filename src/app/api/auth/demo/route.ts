import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { HttpError, assertSameOrigin, clientIp, handler, parseJson, rateLimit } from "@/lib/http";
import { DEMO_ACCOUNTS } from "@/lib/demo";

/** Local development only. env() refuses to boot with ALLOW_DEMO_LOGIN=true in production. */
export const POST = handler(async (req) => {
  if (!env().ALLOW_DEMO_LOGIN || env().NODE_ENV === "production") throw new HttpError(404, "Not found");
  assertSameOrigin(req);
  rateLimit("auth", clientIp(req));
  const { as } = await parseJson(req, z.object({ as: z.enum(Object.keys(DEMO_ACCOUNTS) as [keyof typeof DEMO_ACCOUNTS]) }));
  const [user] = await db().select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, DEMO_ACCOUNTS[as].id));
  if (!user) throw new HttpError(400, "Run `npm run db:seed` first");
  await createSession(user.id, { elevated: true });
  return NextResponse.json({ ok: true });
});
