import { htmlToText, collapse, safeText } from "./sanitize.ts";

export interface GmailPart { mimeType?: string; filename?: string; headers?: { name: string; value: string }[]; body?: { data?: string; size?: number }; parts?: GmailPart[] }

export const decodeBase64Url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

export function header(part: GmailPart | undefined, name: string): string {
  return part?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}
export function parseFrom(raw: string): { name: string; email: string } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(raw);
  const email = (m ? m[2] : raw).trim().toLowerCase();
  return { name: safeText(m ? m[1].trim() : "").slice(0, 120), email: email.slice(0, 254) };
}
/** Prefers text/plain; falls back to stripped text/html. Depth and size bounded. Attachments ignored. */
export function extractBody(payload: GmailPart, maxChars = 20_000): string {
  let plain = "", html = "";
  const walk = (p: GmailPart, depth: number) => {
    if (depth > 8 || (plain.length > maxChars && html.length > maxChars)) return;
    if (p.filename) return;
    if (p.body?.data) {
      if (p.mimeType === "text/plain") plain += decodeBase64Url(p.body.data) + "\n";
      else if (p.mimeType === "text/html") html += decodeBase64Url(p.body.data) + "\n";
    }
    p.parts?.forEach((c) => walk(c, depth + 1));
  };
  walk(payload, 0);
  const text = plain.trim() ? collapse(safeText(plain)) : htmlToText(html);
  return text.slice(0, maxChars);
}
export const gmailPermalink = (id: string, account: string) => `https://mail.google.com/mail/?authuser=${encodeURIComponent(account)}#all/${id}`;
