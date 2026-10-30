import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { buildAuthUrl } from "@/lib/gmail";
import { createPkce, signState } from "@/lib/oauth-state";

export const dynamic = "force-dynamic";
// GET is acceptable here: it only redirects to Google; the state is bound to the session user + a PKCE cookie, so a forged link cannot attach someone else's mailbox.
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.redirect(new URL("/login", env().APP_URL));
  if (env().DEMO_MODE) return NextResponse.redirect(new URL("/dashboard?notice=demo_mode_no_gmail", env().APP_URL));
  const { verifier, challenge } = createPkce();
  const nonce = randomBytes(16).toString("base64url");
  const state = signState({ uid: session.user.id, nonce, exp: Date.now() + 10 * 60_000 }, env().BETTER_AUTH_SECRET);
  const res = NextResponse.redirect(buildAuthUrl(state, challenge));
  res.cookies.set("gmail_oauth", JSON.stringify({ nonce, verifier }), { httpOnly: true, secure: env().APP_URL.startsWith("https"), sameSite: "lax", path: "/api/gmail", maxAge: 600 });
  return res;
}
