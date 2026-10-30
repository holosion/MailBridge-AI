// Separate long-running process: `npm run worker` (or `npm run worker:once` to drain due jobs and exit).
import { prisma } from "../lib/db.ts";
import { claimNext, defer, enqueue, fail, succeed, type ClaimedJob } from "../lib/jobs.ts";
import { DeferError, failPendingAttempt, processSendJob, sweepStuckAttempts, requestNotification } from "../lib/notify.ts";
import { purgeRetention } from "../lib/retention.ts";
import { log } from "../lib/log.ts";

import { syncGmailAccount } from "../lib/gmail-sync.ts";
import { parseHHmm } from "../lib/quiet-hours.ts";

const once = process.argv.includes("--once");
let stopping = false;
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => { stopping = true; log("info", "worker_stopping"); });

async function handle(job: ClaimedJob) {
  switch (job.type) {
    case "SEND_NOTIFICATION": return processSendJob(job);
    case "SYNC_EMAILS": {
      if (!job.userId) return;
      const res = await syncGmailAccount(job.userId, job.payload?.accountId);
      log("info", "sync_job_completed", { userId: job.userId, newEmails: res.newEmails, newSummaries: res.newSummaries });
      return;
    }
    case "DAILY_DIGEST": {
      if (!job.userId) return;
      const dest = await prisma.notificationDestination.findFirst({ where: { userId: job.userId, status: "VERIFIED" } });
      if (!dest) {
        log("info", "digest_skipped_no_verified_destination", { userId: job.userId });
        return;
      }
      const dateStr = String(job.payload?.dateStr ?? new Date().toISOString().slice(0, 10));
      await requestNotification(job.userId, { destinationId: dest.id, kind: "DIGEST", digestDate: dateStr });
      return;
    }
    case "SWEEP_STUCK_ATTEMPTS": return void log("info", "swept", { count: await sweepStuckAttempts() });
    case "PURGE_RETENTION": return void log("info", "retention_done", await purgeRetention());
    default: throw new Error(`Unhandled job type ${job.type}`);
  }
}
async function runOne(job: ClaimedJob) {
  try {
    if (job.attempts > job.maxAttempts) throw new Error("max attempts exceeded (possible crash loop)");
    await handle(job);
    await succeed(job.id);
  } catch (e) {
    if (e instanceof DeferError) { await defer(job.id, e.runAt); log("info", "job_deferred_quiet_hours", { jobId: job.id, runAt: e.runAt.toISOString() }); return; }
    const msg = e instanceof Error ? e.message : "unknown error";
    const dead = await fail(job, msg);
    log(dead ? "error" : "warn", dead ? "job_dead" : "job_retry", { jobId: job.id, type: job.type, attempts: job.attempts, err: msg });
    if (dead && job.type === "SEND_NOTIFICATION" && job.userId) await failPendingAttempt(job.userId, job.payload?.attemptId, msg);
  }
}

export function isDigestDue(pref: { timezone: string; digestTime: string; lastDigestSentAt: Date | null }, now = new Date()): { due: boolean; dateStr: string } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: pref.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
    const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: pref.timezone }).format(now); // YYYY-MM-DD
    const currentMins = parseHHmm(parts);
    const targetMins = parseHHmm(pref.digestTime);
    if (currentMins === null || targetMins === null || currentMins < targetMins) {
      return { due: false, dateStr };
    }
    if (!pref.lastDigestSentAt) {
      return { due: true, dateStr };
    }
    const lastSentDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: pref.timezone }).format(pref.lastDigestSentAt);
    return { due: lastSentDateStr !== dateStr, dateStr };
  } catch {
    return { due: false, dateStr: now.toISOString().slice(0, 10) };
  }
}

async function scheduleHousekeeping() {
  const now = new Date(), minute = now.toISOString().slice(0, 16), day = now.toISOString().slice(0, 10);
  await enqueue({ type: "SWEEP_STUCK_ATTEMPTS", dedupeKey: `sweep:${minute}` });
  await enqueue({ type: "PURGE_RETENTION", dedupeKey: `purge:${day}` });

  // 1. Automatic email synchronization scheduling
  const connections = await prisma.connectedEmailAccount.findMany({
    where: { status: "ACTIVE" },
    include: { user: { include: { preference: true } } },
  });
  for (const conn of connections) {
    const pref = conn.user.preference;
    if (pref && !pref.autoSyncEnabled) continue;
    const intervalMins = pref?.syncIntervalMinutes ?? 15;
    const threshold = new Date(Date.now() - intervalMins * 60_000);
    if (!conn.lastSyncAt || conn.lastSyncAt < threshold) {
      const slot = Math.floor(Date.now() / (intervalMins * 60_000));
      await enqueue({
        userId: conn.userId,
        type: "SYNC_EMAILS",
        dedupeKey: `sync:${conn.id}:${slot}`,
        payload: { accountId: conn.id },
      });
    }
  }

  // 2. Automatic daily digest scheduling
  const prefs = await prisma.notificationPreference.findMany({
    where: { digestEnabled: true, notificationsEnabled: true },
  });
  for (const p of prefs) {
    const { due, dateStr } = isDigestDue(p, now);
    if (due) {
      await enqueue({
        userId: p.userId,
        type: "DAILY_DIGEST",
        dedupeKey: `digest:${p.userId}:${dateStr}`,
        payload: { dateStr },
      });
    }
  }
}
async function main() {
  log("info", "worker_started", { once });
  let lastHousekeeping = 0;
  while (!stopping) {
    if (Date.now() - lastHousekeeping > 60_000) { await scheduleHousekeeping(); lastHousekeeping = Date.now(); }
    const job = await claimNext();
    if (job) { await runOne(job); continue; }
    if (once) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  await prisma.$disconnect();
}
if (process.argv[1] && /[\\/]worker[\\/]index\.(?:ts|js)$/.test(process.argv[1])) {
  main().catch((e) => { log("error", "worker_crashed", { err: String(e?.message) }); process.exit(1); });
}
