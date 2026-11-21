import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { verifyMetaSignature } from "@/lib/webhook-signature";
import { handleWhatsAppPayload } from "@/lib/webhook";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Meta subscription handshake
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams, token = env().WHATSAPP_VERIFY_TOKEN;
  if (token && q.get("hub.mode") === "subscribe" && same(q.get("hub.verify_token") ?? "", token)) return new NextResponse(q.get("hub.challenge") ?? "", { status: 200 });
  return new NextResponse("forbidden", { status: 403 });
}
export async function POST(req: NextRequest) {
  const raw = await req.text(); // signature is over the exact raw bytes
  const secret = env().WHATSAPP_APP_SECRET;
  if (!secret || !verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), secret)) { log("warn", "webhook_bad_signature"); return new NextResponse("invalid signature", { status: 401 }); }
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return new NextResponse("bad json", { status: 400 }); }
  try { await handleWhatsAppPayload(payload); } catch (e) { log("error", "webhook_failed", { err: e instanceof Error ? e.message : "unknown" }); return new NextResponse("error", { status: 500 }); } // 500 => Meta retries; handler is idempotent
  return new NextResponse("ok", { status: 200 });
}
