import { Priority } from "@prisma/client";
import { prisma } from "./db.ts";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { getConnection, fetchMessage, listRecent, GmailAuthError, NotConnectedError, GmailRateLimitError } from "./gmail.ts";
import { DEMO_EMAILS } from "./demo-data.ts";
import { htmlToText, truncate } from "./sanitize.ts";
import { summarizeEmail } from "./summarize.ts";
import { requestNotification } from "./notify.ts";

export const PRIORITY_ORDER: Record<Priority, number> = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  URGENT: 4,
};

export function isPriorityEligible(itemPriority: Priority, minPriority: Priority): boolean {
  return (PRIORITY_ORDER[itemPriority] ?? 1) >= (PRIORITY_ORDER[minPriority] ?? 3);
}

export interface SyncResult {
  syncedCount: number;
  newEmails: number;
  newSummaries: number;
  notificationsQueued: number;
  checkpoint: string | null;
  status: "ACTIVE" | "NEEDS_REAUTH" | "DISCONNECTED" | "DEMO";
}

/**
 * Performs incremental Gmail synchronization for a given user.
 * - Uses SyncCheckpoint to track cursor and avoid duplicate fetches.
 * - Bounded to at most maxBatch messages per execution.
 * - Deduplicates against existing email_records (userId, provider, providerMessageId).
 * - Surfaces auth expiry / invalid_grant as NEEDS_REAUTH without crashing.
 * - Automatically summarizes newly ingested emails if autoSyncEnabled is on.
 * - Evaluates priority filtering: sends instant WhatsApp notification if priority >= minPriority,
 *   otherwise leaves for daily digest.
 */
export async function syncGmailAccount(userId: string, accountId?: string, maxBatch = 15): Promise<SyncResult> {
  const isDemo = env().DEMO_MODE;
  const pref = await prisma.notificationPreference.findUnique({ where: { userId } });
  const minPriority: Priority = pref?.minPriority ?? "HIGH";
  const autoSummarize = pref?.autoSyncEnabled ?? true;

  if (isDemo) {
    return await syncDemoAccount(userId, autoSummarize, minPriority);
  }

  const acct = accountId
    ? await prisma.connectedEmailAccount.findFirst({ where: { id: accountId, userId } })
    : await getConnection(userId);

  if (!acct || acct.status === "DISCONNECTED") {
    throw new NotConnectedError("Gmail is not connected");
  }
  if (acct.status === "NEEDS_REAUTH") {
    throw new GmailAuthError("Gmail needs to be reconnected");
  }

  // Retrieve existing checkpoint for this account
  let checkpoint = await prisma.syncCheckpoint.findUnique({
    where: { accountId_kind: { accountId: acct.id, kind: "inbox" } },
  });

  let rawList: { id: string }[] = [];
  try {
    // List bounded batch of recent messages
    rawList = await listRecent(userId, maxBatch);
  } catch (err: any) {
    if (err instanceof GmailAuthError) {
      await prisma.connectedEmailAccount.updateMany({
        where: { id: acct.id, userId },
        data: { status: "NEEDS_REAUTH", lastError: err.message },
      });
      return {
        syncedCount: 0,
        newEmails: 0,
        newSummaries: 0,
        notificationsQueued: 0,
        checkpoint: checkpoint?.cursor ?? null,
        status: "NEEDS_REAUTH",
      };
    }
    if (err instanceof GmailRateLimitError) {
      log("warn", "gmail_sync_rate_limited", { userId, accountId: acct.id });
      return {
        syncedCount: 0,
        newEmails: 0,
        newSummaries: 0,
        notificationsQueued: 0,
        checkpoint: checkpoint?.cursor ?? null,
        status: acct.status,
      };
    }
    throw err;
  }

  let newEmailsCount = 0;
  let newSummariesCount = 0;
  let notificationsQueued = 0;
  let latestCursor = checkpoint?.cursor ?? null;

  // Process bounded batch
  for (const item of rawList.slice(0, maxBatch)) {
    // Duplicate protection: check if email record already exists
    const existing = await prisma.emailRecord.findUnique({
      where: { userId_provider_providerMessageId: { userId, provider: "gmail", providerMessageId: item.id } },
      select: { id: true },
    });

    if (existing) {
      continue;
    }

    try {
      const full = await fetchMessage(userId, item.id);
      await prisma.emailRecord.create({
        data: {
          userId,
          connectedAccountId: acct.id,
          provider: "gmail",
          providerMessageId: full.id,
          threadId: full.threadId,
          subject: full.subject,
          senderName: full.senderName || null,
          senderEmail: full.senderEmail,
          snippet: full.snippet,
          bodyText: truncate(full.body, 8000),
          receivedAt: full.receivedAt,
          permalink: full.permalink,
          isDemo: false,
        },
      });
      newEmailsCount++;

      // Update cursor with internal date
      const msgTimestamp = full.receivedAt.getTime().toString();
      if (!latestCursor || msgTimestamp > latestCursor) {
        latestCursor = msgTimestamp;
      }

      // Auto-summarize & check priority for instant alert
      if (autoSummarize) {
        const sum = await summarizeEmail(userId, full.id);
        newSummariesCount++;

        if (isPriorityEligible(sum.priority, minPriority)) {
          const dest = await prisma.notificationDestination.findFirst({
            where: { userId, status: "VERIFIED" },
          });
          if (dest) {
            try {
              await requestNotification(userId, {
                destinationId: dest.id,
                kind: "SUMMARY",
                summaryId: sum.id,
              });
              notificationsQueued++;
            } catch (notifyErr) {
              log("warn", "auto_notify_failed", { err: notifyErr instanceof Error ? notifyErr.message : "unknown" });
            }
          }
        }
      }
    } catch (msgErr: any) {
      log("warn", "sync_message_fetch_failed", { msgId: item.id, err: msgErr?.message });
    }
  }

  // Persist updated checkpoint and lastSyncAt
  const now = new Date();
  await prisma.syncCheckpoint.upsert({
    where: { accountId_kind: { accountId: acct.id, kind: "inbox" } },
    create: { accountId: acct.id, kind: "inbox", cursor: latestCursor, lastRunAt: now },
    update: { cursor: latestCursor, lastRunAt: now },
  });

  await prisma.connectedEmailAccount.updateMany({
    where: { id: acct.id, userId },
    data: { lastSyncAt: now, lastError: null },
  });

  return {
    syncedCount: rawList.length,
    newEmails: newEmailsCount,
    newSummaries: newSummariesCount,
    notificationsQueued,
    checkpoint: latestCursor,
    status: "ACTIVE",
  };
}

/** Demo sync implementation: handles incremental ingestion from synthetic dataset */
async function syncDemoAccount(userId: string, autoSummarize: boolean, minPriority: Priority): Promise<SyncResult> {
  let acct = await prisma.connectedEmailAccount.findFirst({
    where: { userId, provider: "gmail" },
  });

  if (!acct) {
    acct = await prisma.connectedEmailAccount.create({
      data: {
        userId,
        emailAddress: "demo-user@example.test",
        scopes: "demo",
        status: "ACTIVE",
      },
    });
  }

  let checkpoint = await prisma.syncCheckpoint.findUnique({
    where: { accountId_kind: { accountId: acct.id, kind: "inbox" } },
  });

  let newEmailsCount = 0;
  let newSummariesCount = 0;
  let notificationsQueued = 0;
  let latestCursor = checkpoint?.cursor ?? "demo-step-0";

  for (const d of DEMO_EMAILS) {
    const existing = await prisma.emailRecord.findUnique({
      where: { userId_provider_providerMessageId: { userId, provider: "gmail", providerMessageId: d.id } },
      select: { id: true },
    });

    if (existing) continue;

    const receivedAt = new Date(Date.now() - d.hoursAgo * 3_600_000);
    await prisma.emailRecord.create({
      data: {
        userId,
        connectedAccountId: acct.id,
        provider: "gmail",
        providerMessageId: d.id,
        threadId: d.id,
        subject: d.subject,
        senderName: d.senderName,
        senderEmail: d.senderEmail,
        snippet: d.snippet,
        bodyText: truncate(htmlToText(d.body), 8000),
        receivedAt,
        permalink: `demo://${d.id}`,
        isDemo: true,
      },
    });
    newEmailsCount++;

    if (autoSummarize) {
      try {
        const sum = await summarizeEmail(userId, d.id);
        newSummariesCount++;

        if (isPriorityEligible(sum.priority, minPriority)) {
          const dest = await prisma.notificationDestination.findFirst({
            where: { userId, status: "VERIFIED" },
          });
          if (dest) {
            try {
              await requestNotification(userId, {
                destinationId: dest.id,
                kind: "SUMMARY",
                summaryId: sum.id,
              });
              notificationsQueued++;
            } catch (e) {
              log("warn", "demo_auto_notify_skipped", { err: e instanceof Error ? e.message : "unknown" });
            }
          }
        }
      } catch (sumErr) {
        log("warn", "demo_auto_summarize_failed", { msgId: d.id, err: sumErr instanceof Error ? sumErr.message : "unknown" });
      }
    }
  }

  latestCursor = `demo-step-${newEmailsCount > 0 ? Date.now() : checkpoint?.cursor ?? "0"}`;
  const now = new Date();

  await prisma.syncCheckpoint.upsert({
    where: { accountId_kind: { accountId: acct.id, kind: "inbox" } },
    create: { accountId: acct.id, kind: "inbox", cursor: latestCursor, lastRunAt: now },
    update: { cursor: latestCursor, lastRunAt: now },
  });

  await prisma.connectedEmailAccount.updateMany({
    where: { id: acct.id, userId },
    data: { lastSyncAt: now },
  });

  return {
    syncedCount: DEMO_EMAILS.length,
    newEmails: newEmailsCount,
    newSummaries: newSummariesCount,
    notificationsQueued,
    checkpoint: latestCursor,
    status: "DEMO",
  };
}
