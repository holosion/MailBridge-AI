// Separate long-running process: `npm run worker` (or `npm run worker:once` to drain due jobs and exit).
import { prisma } from "../lib/db.ts";
import { claimNext, defer, enqueue, fail, succeed, type ClaimedJob } from "../lib/jobs.ts";
import { DeferError, failPendingAttempt, processSendJob, sweepStuckAttempts } from "../lib/notify.ts";
import { purgeRetention } from "../lib/retention.ts";
import { log } from "../lib/log.ts";

const once = process.argv.includes("--once");
let stopping = false;
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => { stopping = true; log("info", "worker_stopping"); });

async function handle(job: ClaimedJob) {
  switch (job.type) {
    case "SEND_NOTIFICATION": return processSendJob(job);
    case "SWEEP_STUCK_ATTEMPTS": return void log("info", "swept", { count: await sweepStuckAttempts() });
    case "PURGE_RETENTION": return void log("info", "retention_done", await purgeRetention());
    default: throw new Error(`Unhandled job type ${job.type}`); // SYNC_EMAILS is modelled but not implemented in Phase 1
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
async function scheduleHousekeeping() {
  const now = new Date(), minute = now.toISOString().slice(0, 16), day = now.toISOString().slice(0, 10);
  await enqueue({ type: "SWEEP_STUCK_ATTEMPTS", dedupeKey: `sweep:${minute}` });
  await enqueue({ type: "PURGE_RETENTION", dedupeKey: `purge:${day}` });
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
main().catch((e) => { log("error", "worker_crashed", { err: String(e?.message) }); process.exit(1); });
