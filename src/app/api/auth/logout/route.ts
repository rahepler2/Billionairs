import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";
import { assertSameOrigin, handler } from "@/lib/http";

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  await destroySession();
  return NextResponse.json({ ok: true });
});
