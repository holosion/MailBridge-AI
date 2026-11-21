import { prisma } from "./db.ts";
import { env } from "./env.ts";

const ago = (days: number) => new Date(Date.now() - days * 86_400_000);
/** See docs/ARCHITECTURE.md "Retention". Runs daily from the worker. */
export async function purgeRetention() {
  const e = env();
  const body = await prisma.emailRecord.updateMany({ where: { bodyText: { not: null }, updatedAt: { lt: ago(e.RETENTION_BODY_DAYS) } }, data: { bodyText: null } });
  const emails = await prisma.emailRecord.deleteMany({ where: { createdAt: { lt: ago(e.RETENTION_EMAIL_DAYS) } } });
  const hist = ago(e.RETENTION_HISTORY_DAYS);
  const events = await prisma.deliveryEvent.deleteMany({ where: { receivedAt: { lt: hist } } });
  const attempts = await prisma.notificationAttempt.deleteMany({ where: { createdAt: { lt: hist }, status: { in: ["DELIVERED", "READ", "FAILED"] } } });
  const summaries = await prisma.summary.deleteMany({ where: { createdAt: { lt: hist } } });
  const jobs = await prisma.backgroundJob.deleteMany({ where: { status: { in: ["SUCCEEDED", "DEAD"] }, updatedAt: { lt: ago(30) } } });
  const sessions = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const verifs = await prisma.verification.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return { bodiesNulled: body.count, emails: emails.count, events: events.count, attempts: attempts.count, summaries: summaries.count, jobs: jobs.count, sessions: sessions.count, verifications: verifs.count };
}
