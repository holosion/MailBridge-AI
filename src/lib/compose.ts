// Builds WhatsApp message content. Template variables may not contain newlines/tabs or long space runs.
const flat = (s: string, max: number) => { const t = s.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim(); return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`; };
export interface Composable { subject: string; senderName: string | null; senderEmail: string; mainMessage: string; requiredAction: string | null; deadlineText: string | null; priority: string }

/** Template "mail_summary": "Email from {{1}} - {{2}}: {{3}} Action: {{4}} Priority: {{5}}" */
export function templateParams(s: Composable): string[] {
  const action = [s.requiredAction, s.deadlineText ? `(deadline: ${s.deadlineText})` : null].filter(Boolean).join(" ") || "None";
  return [flat(s.senderName || s.senderEmail, 60), flat(s.subject, 80), flat(s.mainMessage, 300), flat(action, 200), s.priority];
}
export function textBody(s: Composable): string {
  const lines = [`Email from ${flat(s.senderName || s.senderEmail, 60)}: ${flat(s.subject, 100)}`, flat(s.mainMessage, 400)];
  if (s.requiredAction) lines.push(`Action: ${flat(s.requiredAction, 200)}`);
  if (s.deadlineText) lines.push(`Deadline: ${flat(s.deadlineText, 100)}`);
  lines.push(`Priority: ${s.priority}`);
  return lines.join("\n");
}

export function composeDigestBody(summaries: Composable[], dateStr: string): string {
  const lines = [
    `📬 Mail Bridge AI Daily Digest (${dateStr})`,
    `You have ${summaries.length} email summar${summaries.length === 1 ? "y" : "ies"}:`,
    "",
  ];
  for (const s of summaries.slice(0, 8)) {
    const sender = flat(s.senderName || s.senderEmail, 25);
    const subject = flat(s.subject, 35);
    const action = s.requiredAction ? ` · Action: ${flat(s.requiredAction, 40)}` : "";
    const deadline = s.deadlineText ? ` (Due: ${flat(s.deadlineText, 25)})` : "";
    lines.push(`• [${s.priority}] ${sender}: ${subject}${action}${deadline}`);
  }
  if (summaries.length > 8) {
    lines.push(`…and ${summaries.length - 8} more in your dashboard.`);
  }
  lines.push("");
  lines.push("Open Mail Bridge AI dashboard to view full details.");
  return lines.join("\n");
}
