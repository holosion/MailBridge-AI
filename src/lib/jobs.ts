import { Prisma } from "@prisma/client";
import { prisma } from "./db.ts";
import { backoffMs } from "./retry.ts";

export interface ClaimedJob { id: string; userId: string | null; type: string; payload: any; attempts: number; maxAttempts: number }

/** Creates a job unless one with the same dedupeKey exists (unique constraint). Returns false if it was a duplicate. */
export async function enqueue(job: { userId?: string; type: "SEND_NOTIFICATION" | "SWEEP_STUCK_ATTEMPTS" | "PURGE_RETENTION"; dedupeKey: string; payload?: object; runAt?: Date }) {
  try {
    await prisma.backgroundJob.create({ data: { userId: job.userId, type: job.type, dedupeKey: job.dedupeKey, payload: job.payload ?? {}, runAt: job.runAt ?? new Date() } });
    return true;
  } catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false; throw e; }
}

/** Atomically leases one due job (FOR UPDATE SKIP LOCKED). Expired leases (worker crash) are re-claimed; every claim counts as an attempt. */
export async function claimNext(leaseMs = 60_000): Promise<ClaimedJob | null> {
  const rows = await prisma.$queryRaw<ClaimedJob[]>(Prisma.sql`
    UPDATE "background_jobs" SET "status" = 'RUNNING', "attempts" = "attempts" + 1, "updatedAt" = now(), "lockedUntil" = now() + (${leaseMs}::double precision * interval '1 millisecond')
    WHERE "id" = (SELECT "id" FROM "background_jobs"
                  WHERE ("status" = 'QUEUED' AND "runAt" <= now()) OR ("status" = 'RUNNING' AND "lockedUntil" < now())
                  ORDER BY "runAt" LIMIT 1 FOR UPDATE SKIP LOCKED)
    RETURNING "id", "userId", "type", "payload", "attempts", "maxAttempts"`);
  return rows[0] ?? null;
}
export const succeed = (id: string) => prisma.backgroundJob.update({ where: { id }, data: { status: "SUCCEEDED", lockedUntil: null, lastError: null } });
export const defer = (id: string, runAt: Date) => prisma.backgroundJob.update({ where: { id }, data: { status: "QUEUED", runAt, lockedUntil: null, attempts: { decrement: 1 } } });
/** Returns true when the job is now DEAD (retries exhausted). */
export async function fail(job: ClaimedJob, error: string): Promise<boolean> {
  const dead = job.attempts >= job.maxAttempts;
  await prisma.backgroundJob.update({ where: { id: job.id }, data: { status: dead ? "DEAD" : "QUEUED", lockedUntil: null, lastError: error.slice(0, 500), runAt: dead ? undefined : new Date(Date.now() + backoffMs(job.attempts)) } });
  return dead;
}
