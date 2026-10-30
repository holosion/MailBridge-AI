import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getConnection } from "@/lib/gmail";
import { maskPhone } from "@/lib/phone";
import { Emails, Destinations, SummaryList, History, SignOut, Notice, Disconnect } from "@/components/panels";

export const dynamic = "force-dynamic";
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const user = await requireUser();
  const [conn, dests, summaries, attempts, pref] = await Promise.all([
    getConnection(user.id),
    prisma.notificationDestination.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.summary.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.notificationAttempt.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20, include: { summary: { select: { subject: true } }, destination: { select: { e164: true } } } }),
    prisma.notificationPreference.findUnique({ where: { userId: user.id } }),
  ]);
  const demo = env().DEMO_MODE, waMock = env().WHATSAPP_PROVIDER === "mock", aiMock = env().AI_PROVIDER === "mock";
  const pending = attempts.some((a) => ["PENDING", "SENDING", "ACCEPTED", "SENT"].includes(a.status));
  return (
    <main>
      <div className="top"><div><h1>Mail Bridge AI</h1><span className="mute">{user.email}</span></div><SignOut /></div>
      {(demo || waMock || aiMock) && <div className="banner" role="status"><b>DEMO / MOCK ACTIVE:</b> {demo && "synthetic emails (no Gmail) · "}{aiMock && "heuristic summaries (no AI model) · "}{waMock && "simulated WhatsApp (nothing is sent)"}. Results below are not live verification.</div>}
      <Notice />
      <div className="grid">
        <section className="card"><h2>Gmail connection</h2>
          {demo ? <p className="mute">Demo mode: using synthetic emails.</p> : !conn || conn.status === "DISCONNECTED" ? <p><a className="btn primary" href="/api/gmail/connect">Connect Gmail (read-only)</a></p>
            : <p><span className={conn.status === "ACTIVE" ? "ok" : "bad"}>● {conn.status === "ACTIVE" ? "Connected" : "Needs reconnect"}</span> · {conn.emailAddress}<br />
              <span className="mute">Scope: read-only. Tokens encrypted at rest.</span></p>}
          {!demo && conn && conn.status !== "DISCONNECTED" && <div className="row"><a className="btn" href="/api/gmail/connect">Reconnect</a><Disconnect /></div>}
        </section>
        <Destinations items={dests.map((d) => ({ id: d.id, phone: maskPhone(d.e164), status: d.status, verifiedAt: d.verifiedAt?.toISOString() ?? null }))} canAttest={env().ALLOW_OWNER_ATTEST} pref={pref ? { timezone: pref.timezone, start: pref.quietHoursStart, end: pref.quietHoursEnd, enabled: pref.notificationsEnabled } : null} />
        <Emails destinations={dests.filter((d) => d.status === "VERIFIED").map((d) => ({ id: d.id, phone: maskPhone(d.e164) }))} connected={demo || conn?.status === "ACTIVE"} />
        <SummaryList items={summaries.map((s) => ({ id: s.id, subject: s.subject, sender: s.senderName ? `${s.senderName} <${s.senderEmail}>` : s.senderEmail, mainMessage: s.mainMessage, requiredAction: s.requiredAction, deadline: s.deadlineText,
          priority: s.priority, priorityReason: s.priorityReason, permalink: s.permalink, demo: s.isDemo, provider: `${s.aiProvider}/${s.aiModel}`, warnings: s.warnings, createdAt: s.createdAt.toISOString() }))}
          destinations={dests.filter((d) => d.status === "VERIFIED").map((d) => ({ id: d.id, phone: maskPhone(d.e164) }))} />
        <History poll={pending} items={attempts.map((a) => ({ id: a.id, kind: a.kind, subject: a.summary?.subject ?? null, to: maskPhone(a.destination.e164), status: a.status, error: a.errorMessage, code: a.errorCode, providerId: a.providerMessageId, demo: a.isDemo, at: a.createdAt.toISOString() }))} />
      </div>
    </main>
  );
}
