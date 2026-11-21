import { randomUUID } from "node:crypto";
import { env } from "./env.ts";
import { toWhatsAppId } from "./phone.ts";
import { log } from "./log.ts";

export type SendRequest =
  | { to: string; mode: "TEMPLATE"; template: { name: string; lang: string; params: string[] } }
  | { to: string; mode: "TEXT"; text: string };
export type SendResult =
  | { kind: "accepted"; messageId: string; provider: string }
  | { kind: "rejected"; code: string; message: string; retryable: boolean; provider: string }   // provider definitively did NOT send
  | { kind: "unknown"; reason: string; provider: string };                                       // may or may not have been sent: NEVER auto-resend

// Meta error codes treated as "definitely not sent, safe to retry later" (throughput / pair rate limits).
const RETRYABLE_CODES = new Set([130429, 131056, 80007]);

export async function sendWhatsApp(req: SendRequest): Promise<SendResult> {
  const e = env();
  if (e.WHATSAPP_PROVIDER === "mock") return { kind: "accepted", messageId: `demo.${randomUUID()}`, provider: "mock" };
  const allow = e.WHATSAPP_LIVE_SEND_ALLOWLIST.split(",").map((s) => s.trim()).filter(Boolean);
  if (!allow.includes(req.to)) return { kind: "rejected", code: "RECIPIENT_NOT_AUTHORIZED", message: "Recipient is not in WHATSAPP_LIVE_SEND_ALLOWLIST", retryable: false, provider: "whatsapp_cloud" };

  const payload: Record<string, unknown> = { messaging_product: "whatsapp", recipient_type: "individual", to: toWhatsAppId(req.to) };
  if (req.mode === "TEMPLATE") {
    payload.type = "template";
    payload.template = { name: req.template.name, language: { code: req.template.lang },
      ...(req.template.params.length ? { components: [{ type: "body", parameters: req.template.params.map((text) => ({ type: "text", text })) }] } : {}) };
  } else { payload.type = "text"; payload.text = { body: req.text, preview_url: false }; }

  let res: Response;
  try {
    res = await fetch(`https://graph.facebook.com/${e.WHATSAPP_API_VERSION}/${e.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST", signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${e.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
  } catch (err) { // timeout / network drop AFTER the request may have been processed
    return { kind: "unknown", reason: err instanceof Error ? err.name : "network_error", provider: "whatsapp_cloud" };
  }
  const data = (await res.json().catch(() => null)) as any;
  const id = data?.messages?.[0]?.id as string | undefined;
  if (res.ok && id) return { kind: "accepted", messageId: id, provider: "whatsapp_cloud" };
  if (res.status >= 500 || res.ok) return { kind: "unknown", reason: `http_${res.status}_no_message_id`, provider: "whatsapp_cloud" };
  const code = Number(data?.error?.code ?? res.status);
  log("warn", "whatsapp_rejected", { status: res.status, code, type: data?.error?.type });
  return { kind: "rejected", code: String(code), message: String(data?.error?.message ?? "rejected").slice(0, 300), retryable: res.status === 429 || RETRYABLE_CODES.has(code), provider: "whatsapp_cloud" };
}
