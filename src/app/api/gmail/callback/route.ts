import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { exchangeCode, saveConnection } from "@/lib/gmail";
import { verifyState } from "@/lib/oauth-state";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const back = (n: string) => { const r = NextResponse.redirect(new URL(`/dashboard?notice=${n}`, env().APP_URL)); r.cookies.delete({ name: "gmail_oauth", path: "/api/gmail" }); return r; };
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.redirect(new URL("/login", env().APP_URL));
  const q = req.nextUrl.searchParams;
  if (q.get("error")) return back("gmail_denied");
  let cookie: { nonce: string; verifier: string } | null = null;
  try { cookie = JSON.parse(req.cookies.get("gmail_oauth")?.value ?? "null"); } catch { /* ignore */ }
  const st = verifyState<{ uid: string; nonce: string; exp: number }>(q.get("state") ?? "", env().BETTER_AUTH_SECRET);
  if (!st || !cookie || st.uid !== session.user.id || st.nonce !== cookie.nonce || !q.get("code")) return back("gmail_state_invalid");
  try {
    await saveConnection(session.user.id, await exchangeCode(q.get("code")!, cookie.verifier));
    return back("gmail_connected");
  } catch (e) { log("error", "gmail_connect_failed", { err: e instanceof Error ? e.message : "unknown" }); return back("gmail_failed"); }
}
