import { NextRequest, NextResponse } from "next/server";
import { auth } from "./auth.ts";
import { env } from "./env.ts";
import { log } from "./log.ts";

import { HttpError } from "./errors.ts";
export { HttpError };
/** CSRF defence for cookie-authenticated mutations: Origin must match APP_URL's origin. */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(env().APP_URL).origin) throw new HttpError(403, "bad_origin");
}
export interface Ctx { req: NextRequest; user: { id: string; email: string; name: string }; params: Record<string, string> }

export function route(handler: (c: Ctx) => Promise<Response>) {
  return async (req: NextRequest, c: { params: Promise<Record<string, string>> }) => {
    try {
      if (!["GET", "HEAD"].includes(req.method)) assertSameOrigin(req);
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session) throw new HttpError(401, "unauthorized");
      return await handler({ req, user: session.user, params: await c.params });
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
      log("error", "route_error", { path: req.nextUrl.pathname, err: err instanceof Error ? err.message : "unknown" });
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
  };
}
export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export async function body<T>(req: NextRequest, parse: (x: unknown) => T): Promise<T> {
  try { return parse(await req.json()); } catch { throw new HttpError(400, "invalid_body"); }
}
