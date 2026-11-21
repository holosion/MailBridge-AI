import { prisma } from "./db.ts";
import { env } from "./env.ts";
import { generateSummary, PROMPT_VERSION } from "./ai.ts";
import { fetchMessage, getConnection, listRecent, type MailListItem } from "./gmail.ts";
import { DEMO_EMAILS } from "./demo-data.ts";
import { htmlToText, truncate } from "./sanitize.ts";
import { assertWithinQuota, recordUsage } from "./usage.ts";
import { HttpError } from "./errors.ts";

export async function listEmailsForUser(userId: string): Promise<{ demo: boolean; items: MailListItem[] }> {
  let items: MailListItem[]; const demo = env().DEMO_MODE;
  if (demo) items = DEMO_EMAILS.map((d) => ({ id: d.id, threadId: d.id, subject: d.subject, senderName: d.senderName, senderEmail: d.senderEmail, snippet: d.snippet,
    receivedAt: new Date(Date.now() - d.hoursAgo * 3_600_000).toISOString(), permalink: `demo://${d.id}` }));
  else items = await listRecent(userId, 15);
  const done = await prisma.summary.findMany({ where: { userId, providerMessageId: { in: items.map((i) => i.id) }, promptVersion: PROMPT_VERSION }, select: { providerMessageId: true } });
  const set = new Set(done.map((d) => d.providerMessageId));
  return { demo, items: items.map((i) => ({ ...i, summarized: set.has(i.id) })) };
}

export async function summarizeEmail(userId: string, messageId: string) {
  await assertWithinQuota(userId, "summaries");
  const demo = env().DEMO_MODE;
  let m: { id: string; threadId: string | null; subject: string; senderName: string; senderEmail: string; snippet: string; body: string; receivedAt: Date; permalink: string; connectedAccountId: string | null };
  if (demo) {
    const d = DEMO_EMAILS.find((x) => x.id === messageId);
    if (!d) throw new HttpError(404, "email_not_found");
    m = { id: d.id, threadId: d.id, subject: d.subject, senderName: d.senderName, senderEmail: d.senderEmail, snippet: d.snippet, body: htmlToText(d.body),
      receivedAt: new Date(Date.now() - d.hoursAgo * 3_600_000), permalink: `demo://${d.id}`, connectedAccountId: null };
  } else {
    if (!(await getConnection(userId))) throw new HttpError(409, "gmail_not_connected");
    m = await fetchMessage(userId, messageId);
  }
  // Persist the minimum: metadata + truncated body (nulled by retention). Unique (user, provider, message id) blocks duplicate ingestion.
  const rec = await prisma.emailRecord.upsert({
    where: { userId_provider_providerMessageId: { userId, provider: "gmail", providerMessageId: m.id } },
    create: { userId, connectedAccountId: m.connectedAccountId, providerMessageId: m.id, threadId: m.threadId, subject: m.subject, senderName: m.senderName || null, senderEmail: m.senderEmail,
      snippet: m.snippet, bodyText: truncate(m.body, 8000), receivedAt: m.receivedAt, permalink: m.permalink, isDemo: demo },
    update: { bodyText: truncate(m.body, 8000) },
  });
  const ai = await generateSummary({ subject: m.subject, sender: `${m.senderName} <${m.senderEmail}>`, body: m.body });
  const s = ai.summary;
  const data = { subject: m.subject, senderName: m.senderName || null, senderEmail: m.senderEmail, providerMessageId: m.id, permalink: m.permalink, mainMessage: s.mainMessage,
    requiredAction: s.requiredAction, deadlineText: s.deadlineText, deadlineEvidence: s.deadlineEvidence, priority: s.priority, priorityReason: s.priorityReason,
    aiProvider: ai.provider, aiModel: ai.model, warnings: s.warnings, isDemo: demo };
  const saved = await prisma.summary.upsert({
    where: { emailRecordId_promptVersion: { emailRecordId: rec.id, promptVersion: PROMPT_VERSION } },
    create: { userId, emailRecordId: rec.id, promptVersion: PROMPT_VERSION, ...data }, update: data,
  });
  await recordUsage(userId, "summaries");
  return saved;
}
