import { Prisma } from "@prisma/client";
import { prisma } from "./db.ts";
import { env } from "./env.ts";
import { HttpError } from "./errors.ts";
import { normalizeE164 } from "./phone.ts";
import { inQuietHours, nextQuietEnd } from "./quiet-hours.ts";
import { templateParams, textBody, composeDigestBody } from "./compose.ts";
import { sendWhatsApp, type SendRequest } from "./whatsapp.ts";
import { assertWithinQuota, recordUsage } from "./usage.ts";
import { log } from "./log.ts";

export const CONSENT_TEXT_VERSION = "2026-10-v1"; // text shown in the UI; bump when wording changes
export class DeferError extends Error {
  runAt: Date;
  constructor(runAt: Date) {
    super("deferred");
    this.runAt = runAt;
  }
}
export class RetryError extends Error {}

// ---- destinations & consent -------------------------------------------------
export async function addDestination(userId: string, phone: string, consentGiven: boolean) {
  const e164 = normalizeE164(phone);
  if (!e164) throw new HttpError(400, "invalid_phone", "Use international format, e.g. +256700000000");
  if (!consentGiven) throw new HttpError(400, "consent_required", "You must consent to receive WhatsApp notifications");
  try {
    return await prisma.$transaction(async (tx) => {
      const dest = await tx.notificationDestination.create({ data: { userId, e164 } });
      await tx.consentRecord.create({ data: { userId, destinationId: dest.id, textVersion: CONSENT_TEXT_VERSION, source: "dashboard_checkbox" } });
      await tx.notificationPreference.upsert({ where: { userId }, create: { userId }, update: {} });
      return dest;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError(409, "number_in_use", "That number is already registered");
    throw e;
  }
}
/** Dev/test-number convenience: owner asserts control of the number. Disabled unless ALLOW_OWNER_ATTEST=true. */
export async function attestDestination(userId: string, id: string) {
  if (!env().ALLOW_OWNER_ATTEST) throw new HttpError(403, "attest_disabled");
  const r = await prisma.notificationDestination.updateMany({ where: { id, userId, status: "PENDING" }, data: { status: "VERIFIED", verifiedAt: new Date(), verificationMethod: "owner_attestation" } });
  if (!r.count) throw new HttpError(404, "destination_not_found");
}
export async function revokeDestination(userId: string, id: string) {
  const r = await prisma.notificationDestination.updateMany({ where: { id, userId }, data: { status: "REVOKED" } });
  if (!r.count) throw new HttpError(404, "destination_not_found");
  await prisma.consentRecord.updateMany({ where: { userId, destinationId: id, revokedAt: null }, data: { revokedAt: new Date() } });
}

// ---- requesting a notification (idempotent) ----------------------------------
const BLOCKING: Record<"TEST" | "SUMMARY" | "DIGEST", string[]> = {
  TEST: ["PENDING", "SENDING", "UNKNOWN"],                                                        // another test may follow a finished one
  SUMMARY: ["PENDING", "SENDING", "UNKNOWN", "ACCEPTED", "SENT", "DELIVERED", "READ"],            // one alert per summary+destination unless it FAILED
  DIGEST: ["PENDING", "SENDING", "UNKNOWN", "ACCEPTED", "SENT", "DELIVERED", "READ"],
};
export async function requestNotification(userId: string, a: { destinationId: string; kind: "TEST" | "SUMMARY" | "DIGEST"; summaryId?: string; digestDate?: string }) {
  const dest = await prisma.notificationDestination.findFirst({ where: { id: a.destinationId, userId } });
  if (!dest) throw new HttpError(404, "destination_not_found");
  if (dest.status !== "VERIFIED") throw new HttpError(409, "destination_not_verified", "Verify this number first");
  if (!(await prisma.consentRecord.findFirst({ where: { userId, destinationId: dest.id, revokedAt: null } }))) throw new HttpError(409, "no_consent");
  const pref = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (pref && !pref.notificationsEnabled) throw new HttpError(409, "notifications_disabled");
  if (a.kind === "SUMMARY") {
    if (!a.summaryId || !(await prisma.summary.findFirst({ where: { id: a.summaryId, userId }, select: { id: true } }))) throw new HttpError(404, "summary_not_found");
  }
  await assertWithinQuota(userId, "notifications");

  const tuple = { userId, destinationId: dest.id, summaryId: a.summaryId ?? null, kind: a.kind };
  const digestDate = a.digestDate ?? new Date().toISOString().slice(0, 10);
  const requestKey = a.kind === "DIGEST"
    ? `DIGEST:${userId}:${dest.id}:${digestDate}`
    : `${a.kind}:${userId}:${dest.id}:${a.summaryId ?? "test"}:${await prisma.notificationAttempt.count({ where: tuple })}`;
  const existingByKey = await prisma.notificationAttempt.findUnique({ where: { requestKey } });
  if (existingByKey && existingByKey.userId === userId) return { attempt: existingByKey, duplicate: true };
  const latest = a.kind === "DIGEST"
    ? null
    : await prisma.notificationAttempt.findFirst({ where: tuple, orderBy: { createdAt: "desc" } });
  if (latest && BLOCKING[a.kind].includes(latest.status)) return { attempt: latest, duplicate: true };

  try {
    const attempt = await prisma.$transaction(async (tx) => {
      const att = await tx.notificationAttempt.create({ data: { userId, destinationId: dest.id, summaryId: a.summaryId, kind: a.kind, requestKey, isDemo: env().WHATSAPP_PROVIDER === "mock" } });
      await tx.backgroundJob.create({ data: { userId, type: "SEND_NOTIFICATION", dedupeKey: `send:${att.id}`, payload: { attemptId: att.id } } });
      return att;
    });
    return { attempt, duplicate: false };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") { // concurrent identical request won the race
      const existing = await prisma.notificationAttempt.findUnique({ where: { requestKey } });
      if (existing && existing.userId === userId) return { attempt: existing, duplicate: true };
    }
    throw e;
  }
}

// ---- worker side: send exactly-at-most-once ----------------------------------
async function finish(id: string, userId: string, data: Prisma.NotificationAttemptUncheckedUpdateManyInput) {
  await prisma.notificationAttempt.updateMany({ where: { id, userId }, data });
}
export async function processSendJob(job: { userId: string | null; payload: any }) {
  const attemptId = job.payload?.attemptId as string | undefined;
  if (!attemptId || !job.userId) return;
  const userId = job.userId;
  const a = await prisma.notificationAttempt.findFirst({ where: { id: attemptId, userId }, include: { destination: true, summary: true } });
  if (!a || a.status !== "PENDING") return;           // already handled (worker restart / duplicate job): do nothing, never resend

  const consent = await prisma.consentRecord.findFirst({ where: { userId, destinationId: a.destinationId, revokedAt: null } });
  if (a.destination.status !== "VERIFIED" || !consent) return finish(a.id, userId, { status: "FAILED", errorCode: "NO_CONSENT", errorMessage: "Destination not verified or consent revoked" });
  const pref = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (pref && !pref.notificationsEnabled) return finish(a.id, userId, { status: "FAILED", errorCode: "NOTIFICATIONS_DISABLED", errorMessage: "Notifications disabled" });
  if ((a.kind === "SUMMARY" || a.kind === "DIGEST") && pref && inQuietHours(new Date(), pref.timezone, pref.quietHoursStart, pref.quietHoursEnd))
    throw new DeferError(nextQuietEnd(new Date(), pref.timezone, pref.quietHoursEnd));

  const to = a.destination.e164;
  const windowOpen = !!a.destination.lastInboundAt && Date.now() - a.destination.lastInboundAt.getTime() < 24 * 3_600_000;
  const e = env();
  let req: SendRequest | null;
  if (a.kind === "TEST") {
    req = windowOpen ? { to, mode: "TEXT", text: "Mail Bridge AI test message. If you can read this, delivery works." } : { to, mode: "TEMPLATE", template: { name: e.WHATSAPP_TEMPLATE_TEST, lang: e.WHATSAPP_TEMPLATE_LANG, params: [] } };
  } else if (a.kind === "DIGEST") {
    const since = new Date(Date.now() - 24 * 3_600_000);
    const summaries = await prisma.summary.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 15,
    });
    if (!summaries.length) {
      return finish(a.id, userId, { status: "FAILED", errorCode: "NO_SUMMARIES_FOR_DIGEST", errorMessage: "No email summaries found in the last 24h for a digest" });
    }
    const dateLabel = new Intl.DateTimeFormat("en-US", { timeZone: pref?.timezone ?? "UTC", month: "short", day: "numeric" }).format(new Date());
    const digestText = composeDigestBody(summaries, dateLabel);
    req = windowOpen
      ? { to, mode: "TEXT", text: digestText }
      : e.WHATSAPP_TEMPLATE_SUMMARY
        ? { to, mode: "TEMPLATE", template: { name: e.WHATSAPP_TEMPLATE_SUMMARY, lang: e.WHATSAPP_TEMPLATE_LANG, params: ["Mail Bridge AI", `Digest: ${summaries.length} items`, digestText.slice(0, 300), "Review dashboard", "NORMAL"] } }
        : null;
  } else if (a.summary) {
    const c = { ...a.summary };
    req = e.WHATSAPP_TEMPLATE_SUMMARY ? { to, mode: "TEMPLATE", template: { name: e.WHATSAPP_TEMPLATE_SUMMARY, lang: e.WHATSAPP_TEMPLATE_LANG, params: templateParams(c) } }
      : windowOpen ? { to, mode: "TEXT", text: textBody(c) } : null;
  } else req = null;
  if (!req) return finish(a.id, userId, { status: "FAILED", errorCode: "NO_TEMPLATE_AND_WINDOW_CLOSED", errorMessage: "No approved summary template configured and the 24h window is closed; WhatsApp does not allow free-form messages now" });

  // Claim BEFORE calling the provider. If we crash after this point the attempt stays SENDING and the sweeper marks it UNKNOWN (never resent).
  const claim = await prisma.notificationAttempt.updateMany({ where: { id: a.id, userId, status: "PENDING" }, data: { status: "SENDING", sendStartedAt: new Date(), mode: req.mode } });
  if (claim.count !== 1) return;

  let result;
  try { result = await sendWhatsApp(req); } catch (err) { result = { kind: "unknown" as const, reason: err instanceof Error ? err.message : "exception", provider: "unknown" }; }

  if (result.kind === "accepted") {
    const demo = result.provider === "mock";
    await finish(a.id, userId, { status: demo ? "DELIVERED" : "ACCEPTED", providerName: result.provider, providerMessageId: result.messageId, isDemo: demo, errorCode: null, errorMessage: null });
    if (a.kind === "DIGEST") {
      await prisma.notificationPreference.updateMany({ where: { userId }, data: { lastDigestSentAt: new Date() } });
    }
    const now = new Date();
    await prisma.deliveryEvent.create({ data: { userId, attemptId: a.id, provider: result.provider, providerEventId: `${result.messageId}:accepted`, providerMessageId: result.messageId, status: "accepted", occurredAt: now } });
    if (demo) await prisma.deliveryEvent.create({ data: { userId, attemptId: a.id, provider: "mock", providerEventId: `${result.messageId}:delivered`, providerMessageId: result.messageId, status: "delivered", occurredAt: now, detail: { demo: true } } });
    await recordUsage(userId, "notifications");
  } else if (result.kind === "rejected" && result.retryable) {
    await finish(a.id, userId, { status: "PENDING", sendStartedAt: null });
    throw new RetryError(`rate limited (${result.code})`);
  } else if (result.kind === "rejected") {
    await finish(a.id, userId, { status: "FAILED", providerName: result.provider, errorCode: result.code, errorMessage: result.message });
  } else {
    await finish(a.id, userId, { status: "UNKNOWN", providerName: result.provider, errorCode: "SEND_OUTCOME_UNKNOWN", errorMessage: `Provider outcome unknown (${result.reason}). Not retried automatically to avoid a duplicate alert; check WhatsApp, then resolve manually.` });
    log("warn", "send_outcome_unknown", { attemptId: a.id });
  }
}
/** Job ran out of retries while the attempt was still PENDING (only reachable via rate-limit retries). */
export const failPendingAttempt = (userId: string, attemptId: string, msg: string) =>
  prisma.notificationAttempt.updateMany({ where: { id: attemptId, userId, status: "PENDING" }, data: { status: "FAILED", errorCode: "RETRIES_EXHAUSTED", errorMessage: msg.slice(0, 300) } });

/** Worker died mid-send? Mark UNKNOWN (never auto-resend). */
export async function sweepStuckAttempts(olderThanMs = 120_000) {
  const r = await prisma.notificationAttempt.updateMany({ where: { status: "SENDING", sendStartedAt: { lt: new Date(Date.now() - olderThanMs) } },
    data: { status: "UNKNOWN", errorCode: "STUCK_SENDING", errorMessage: "Worker stopped during send; outcome unknown. Not retried automatically." } });
  return r.count;
}
/** The owner checks their phone, then tells us what happened. 'not_received' re-opens the slot for a deliberate resend. */
export async function resolveUnknown(userId: string, id: string, outcome: "received" | "not_received") {
  const r = await prisma.notificationAttempt.updateMany({ where: { id, userId, status: "UNKNOWN" },
    data: outcome === "received" ? { status: "DELIVERED", resolvedManually: true, errorMessage: "Confirmed received by owner" } : { status: "FAILED", resolvedManually: true, errorCode: "MANUAL_NOT_RECEIVED", errorMessage: "Owner confirmed it was not received" } });
  if (!r.count) throw new HttpError(404, "attempt_not_found_or_not_unknown");
}
