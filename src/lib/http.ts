import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { currentUser, type SessionUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { limiter, type LIMITS } from "@/lib/security/rateLimit";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
  }
}

export function clientIp(req: NextRequest): string {
  // Trust only the first hop set by our own edge/CDN.
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** CSRF defense in depth (cookies are already SameSite=Strict): require same-origin for writes. */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const expected = new URL(env().APP_URL).origin;
  const self = req.nextUrl.origin;
  if (!origin || (origin !== expected && origin !== self)) throw new HttpError(403, "Cross-origin request blocked");
}

export function rateLimit(name: keyof typeof LIMITS, ...keys: string[]) {
  for (const key of keys) {
    const r = limiter(name).check(`${name}:${key}`);
    if (!r.ok) throw new HttpError(429, "Too many requests. Please slow down.", { "Retry-After": String(r.retryAfterSec) });
  }
}

export async function requireUser(roles?: SessionUser["role"][]): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Please sign in first");
  if (roles && !roles.includes(user.role)) throw new HttpError(403, "You don't have access to this");
  return user;
}

export async function parseJson<T extends z.ZodType>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 64_000) throw new HttpError(413, "Request too large");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
  return parsed.data;
}

/** Wrap a route handler: consistent errors, no stack traces or internals leaked. */
export function handler<C>(fn: (req: NextRequest, ctx: C) => Promise<Response>) {
  return async (req: NextRequest, ctx: C) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status, headers: err.headers });
      console.error("[lifted] unhandled", err instanceof Error ? err.message : "unknown error");
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}
