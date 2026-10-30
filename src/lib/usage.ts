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

export async function getUsageStats(userId: string) {
  const currentPeriod = period();
  const summaryLimit = env().MONTHLY_SUMMARY_LIMIT;
  const notificationLimit = env().MONTHLY_NOTIFICATION_LIMIT;

  const records = await prisma.usageRecord.findMany({
    where: { userId, period: currentPeriod },
  });

  const summaryCount = records.find((r) => r.metric === "summaries")?.quantity ?? 0;
  const notificationCount = records.find((r) => r.metric === "notifications")?.quantity ?? 0;

  return {
    period: currentPeriod,
    summaries: {
      used: summaryCount,
      limit: summaryLimit,
      remaining: Math.max(0, summaryLimit - summaryCount),
      pct: summaryLimit > 0 ? Math.min(100, Math.round((summaryCount / summaryLimit) * 100)) : 0,
    },
    notifications: {
      used: notificationCount,
      limit: notificationLimit,
      remaining: Math.max(0, notificationLimit - notificationCount),
      pct: notificationLimit > 0 ? Math.min(100, Math.round((notificationCount / notificationLimit) * 100)) : 0,
    },
  };
}
