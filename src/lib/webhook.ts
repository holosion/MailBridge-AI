import { Prisma } from "@prisma/client";
import { prisma } from "./db.ts";
import { shouldAdvance, type AttemptStatus } from "./retry.ts";
import { log } from "./log.ts";

const STATUS_MAP: Record<string, AttemptStatus> = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" };
const isDup = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
const PROVIDER = "whatsapp_cloud";

/** Idempotent: Meta retries and re-orders webhooks. Duplicates are dropped by the unique (provider, providerEventId) constraint. */
export async function handleWhatsAppPayload(payload: any) {
  for (const entry of payload?.entry ?? []) for (const ch of entry?.changes ?? []) {
    const v = ch?.value ?? {};
    for (const st of v.statuses ?? []) await handleStatus(st).catch((e) => log("error", "webhook_status_error", { err: String(e?.message) }));
    for (const m of v.messages ?? []) await handleInbound(m).catch((e) => log("error", "webhook_inbound_error", { err: String(e?.message) }));
  }
}
async function handleStatus(st: any) {
  const wamid = String(st.id ?? ""), raw = String(st.status ?? ""), next = STATUS_MAP[raw];
  if (!wamid || !next) return;
  const attempt = await prisma.notificationAttempt.findUnique({ where: { providerMessageId: wamid } });
  const err = st.errors?.[0];
  try {
    await prisma.deliveryEvent.create({ data: { userId: attempt?.userId ?? null, attemptId: attempt?.id ?? null, provider: PROVIDER, providerEventId: `${wamid}:${raw}`, providerMessageId: wamid, status: raw,
      occurredAt: new Date(Number(st.timestamp) * 1000 || Date.now()), detail: err ? { code: err.code, title: String(err.title ?? "").slice(0, 200) } : undefined } });
  } catch (e) { if (isDup(e)) return; throw e; }
  if (attempt && shouldAdvance(attempt.status as AttemptStatus, next))
    await prisma.notificationAttempt.updateMany({ where: { id: attempt.id, userId: attempt.userId }, data: { status: next, ...(next === "FAILED" ? { errorCode: String(err?.code ?? "FAILED"), errorMessage: String(err?.title ?? "Delivery failed").slice(0, 300) } : {}) } });
}
async function handleInbound(m: any) {
  const from = String(m.from ?? ""), id = String(m.id ?? "");
  if (!/^\d{8,15}$/.test(from) || !id) return;
  const dest = await prisma.notificationDestination.findFirst({ where: { channel: "whatsapp", e164: `+${from}` } });
  try { // message text is deliberately NOT stored
    await prisma.deliveryEvent.create({ data: { userId: dest?.userId ?? null, provider: PROVIDER, providerEventId: id, status: "inbound", occurredAt: new Date(Number(m.timestamp) * 1000 || Date.now()) } });
  } catch (e) { if (isDup(e)) return; throw e; }
  if (!dest) return;
  const optOut = m.type === "text" && /^(stop|unsubscribe)$/i.test(String(m.text?.body ?? "").trim());
  if (optOut) {
    await prisma.notificationDestination.updateMany({ where: { id: dest.id, userId: dest.userId }, data: { status: "REVOKED" } });
    await prisma.consentRecord.updateMany({ where: { destinationId: dest.id, userId: dest.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return;
  }
  const hasConsent = await prisma.consentRecord.findFirst({ where: { destinationId: dest.id, userId: dest.userId, revokedAt: null } });
  await prisma.notificationDestination.updateMany({ where: { id: dest.id, userId: dest.userId },
    data: { lastInboundAt: new Date(), ...(dest.status === "PENDING" && hasConsent ? { status: "VERIFIED", verifiedAt: new Date(), verificationMethod: "inbound_message" } : {}) } });
}
