import { prisma } from "./db.ts";
import { env } from "./env.ts";
import { HttpError } from "./errors.ts";

const period = () => new Date().toISOString().slice(0, 7);
// Quotas are the seam for future subscriptions: replace the env limits with a per-plan lookup (docs/ARCHITECTURE.md).
export async function assertWithinQuota(userId: string, metric: "summaries" | "notifications") {
  const limit = metric === "summaries" ? env().MONTHLY_SUMMARY_LIMIT : env().MONTHLY_NOTIFICATION_LIMIT;
  const row = await prisma.usageRecord.findUnique({ where: { userId_metric_period: { userId, metric, period: period() } } });
  if ((row?.quantity ?? 0) >= limit) throw new HttpError(429, "quota_exceeded", `Monthly ${metric} limit (${limit}) reached`);
}
export async function recordUsage(userId: string, metric: "summaries" | "notifications") {
  await prisma.usageRecord.upsert({
    where: { userId_metric_period: { userId, metric, period: period() } },
    create: { userId, metric, period: period(), quantity: 1 }, update: { quantity: { increment: 1 } },
  });
}
