import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getConnection } from "@/lib/gmail";
import { maskPhone } from "@/lib/phone";
import { getUsageStats } from "@/lib/usage";
import {
  OnboardingGuide,
  GmailPanel,
  DestinationsPanel,
  PreferencesPanel,
  UsagePanel,
  EmailsPanel,
  SummaryListPanel,
  HistoryPanel,
  AccountSettingsPanel,
  SignOut,
  Notice,
} from "@/components/panels";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const user = await requireUser();
  const [conn, dests, summaries, attempts, pref, usage] = await Promise.all([
    getConnection(user.id),
    prisma.notificationDestination.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.summary.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.notificationAttempt.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { summary: { select: { subject: true } }, destination: { select: { e164: true } } },
    }),
    prisma.notificationPreference.findUnique({ where: { userId: user.id } }),
    getUsageStats(user.id),
  ]);

  const checkpoint = conn
    ? await prisma.syncCheckpoint.findUnique({ where: { accountId_kind: { accountId: conn.id, kind: "inbox" } } })
    : null;

  const demo = env().DEMO_MODE;
  const waMock = env().WHATSAPP_PROVIDER === "mock";
  const aiMock = env().AI_PROVIDER === "mock";
  const pending = attempts.some((a) => ["PENDING", "SENDING", "ACCEPTED", "SENT"].includes(a.status));

  // Determine onboarding progress
  const hasGmail = demo || conn?.status === "ACTIVE";
  const hasVerifiedDest = dests.some((d) => d.status === "VERIFIED");
  const hasCustomPref = !!pref;
  const hasDelivered = attempts.some((a) => ["DELIVERED", "READ"].includes(a.status));

  return (
    <main>
      <header className="top">
        <div>
          <h1>Mail Bridge AI</h1>
          <span className="mute">{user.email}</span>
        </div>
        <div className="row">
          <SignOut />
        </div>
      </header>

      {(demo || waMock || aiMock) && (
        <div className="banner" role="status">
          <b>DEMO / MOCK ACTIVE:</b>{" "}
          {demo && "Synthetic emails (no live Google OAuth) · "}
          {aiMock && "Deterministic heuristic summaries (no AI billing) · "}
          {waMock && "Simulated WhatsApp delivery (no live messages sent)"}. All demo actions remain local.
        </div>
      )}

      <Notice />

      <OnboardingGuide
        hasGmail={hasGmail}
        hasVerifiedDest={hasVerifiedDest}
        hasCustomPref={hasCustomPref}
        hasDelivered={hasDelivered}
      />

      <div className="grid">
        <GmailPanel
          conn={
            conn
              ? {
                  emailAddress: conn.emailAddress,
                  status: conn.status,
                  lastSyncAt: conn.lastSyncAt?.toISOString() ?? null,
                }
              : null
          }
          demo={demo}
          checkpoint={
            checkpoint
              ? {
                  cursor: checkpoint.cursor,
                  lastRunAt: checkpoint.lastRunAt?.toISOString() ?? null,
                }
              : null
          }
        />

        <UsagePanel stats={usage} />

        <DestinationsPanel
          items={dests.map((d) => ({
            id: d.id,
            phone: maskPhone(d.e164),
            status: d.status,
            verifiedAt: d.verifiedAt?.toISOString() ?? null,
          }))}
          canAttest={env().ALLOW_OWNER_ATTEST}
        />

        <PreferencesPanel
          pref={
            pref
              ? {
                  timezone: pref.timezone,
                  quietHoursStart: pref.quietHoursStart,
                  quietHoursEnd: pref.quietHoursEnd,
                  notificationsEnabled: pref.notificationsEnabled,
                  minPriority: pref.minPriority,
                  digestEnabled: pref.digestEnabled,
                  digestTime: pref.digestTime,
                  autoSyncEnabled: pref.autoSyncEnabled,
                  syncIntervalMinutes: pref.syncIntervalMinutes,
                  lastDigestSentAt: pref.lastDigestSentAt?.toISOString() ?? null,
                }
              : null
          }
          destinations={dests.map((d) => ({
            id: d.id,
            phone: maskPhone(d.e164),
            status: d.status,
            verifiedAt: d.verifiedAt?.toISOString() ?? null,
          }))}
        />

        <EmailsPanel connected={hasGmail} />

        <SummaryListPanel
          items={summaries.map((s) => ({
            id: s.id,
            subject: s.subject,
            sender: s.senderName ? `${s.senderName} <${s.senderEmail}>` : s.senderEmail,
            mainMessage: s.mainMessage,
            requiredAction: s.requiredAction,
            deadline: s.deadlineText,
            priority: s.priority,
            priorityReason: s.priorityReason,
            permalink: s.permalink,
            demo: s.isDemo,
            provider: `${s.aiProvider}/${s.aiModel}`,
            warnings: s.warnings,
            createdAt: s.createdAt.toISOString(),
          }))}
          destinations={dests.map((d) => ({
            id: d.id,
            phone: maskPhone(d.e164),
            status: d.status,
            verifiedAt: d.verifiedAt?.toISOString() ?? null,
          }))}
        />

        <HistoryPanel
          poll={pending}
          items={attempts.map((a) => ({
            id: a.id,
            kind: a.kind,
            subject: a.summary?.subject ?? null,
            to: maskPhone(a.destination.e164),
            status: a.status,
            error: a.errorMessage,
            code: a.errorCode,
            providerId: a.providerMessageId,
            demo: a.isDemo,
            at: a.createdAt.toISOString(),
          }))}
        />

        <AccountSettingsPanel userEmail={user.email} />
      </div>
    </main>
  );
}
