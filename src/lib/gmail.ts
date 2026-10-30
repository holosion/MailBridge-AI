import { prisma } from "./db.ts";
import { env, keyRing } from "./env.ts";
import { encrypt, decrypt } from "./crypto.ts";
import { extractBody, gmailPermalink, header, parseFrom, type GmailPart } from "./gmail-parse.ts";
import { safeText, truncate } from "./sanitize.ts";
import { log } from "./log.ts";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"; // minimum scope that allows reading message bodies
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
export class GmailAuthError extends Error {}
export class GmailRateLimitError extends Error {}
export class NotConnectedError extends Error {}
const aad = (userId: string, accountId: string, kind: string) => `${userId}:${accountId}:${kind}`;

export function buildAuthUrl(state: string, challenge: string) {
  const p = new URLSearchParams({
    client_id: env().GOOGLE_CLIENT_ID!, redirect_uri: `${env().APP_URL}/api/gmail/callback`, response_type: "code",
    scope: GMAIL_SCOPE, access_type: "offline", prompt: "consent", state, code_challenge: challenge, code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}
async function tokenRequest(params: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env().GOOGLE_CLIENT_ID!, client_secret: env().GOOGLE_CLIENT_SECRET!, ...params }), signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw Object.assign(new Error(data.error ?? `token_http_${res.status}`), { oauthError: data.error as string | undefined });
  return data as { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
}
export const exchangeCode = (code: string, verifier: string) =>
  tokenRequest({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: `${env().APP_URL}/api/gmail/callback` });

/** Stores tokens encrypted. Rejects if the user un-ticked the Gmail permission on Google's granular consent screen. */
export async function saveConnection(userId: string, t: Awaited<ReturnType<typeof exchangeCode>>) {
  if (!t.scope?.split(" ").includes(GMAIL_SCOPE)) throw new GmailAuthError("Gmail read permission was not granted");
  const profile = await fetch(`${API}/profile`, { headers: { Authorization: `Bearer ${t.access_token}` }, signal: AbortSignal.timeout(15_000) });
  if (!profile.ok) throw new GmailAuthError("Could not read Gmail profile");
  const emailAddress = ((await profile.json()) as any).emailAddress.toLowerCase() as string;
  const existing = await prisma.connectedEmailAccount.findUnique({ where: { userId_provider_emailAddress: { userId, provider: "gmail", emailAddress } } });
  const row = existing ?? (await prisma.connectedEmailAccount.create({ data: { userId, emailAddress, scopes: GMAIL_SCOPE } }));
  let refreshEnc = existing?.refreshTokenEnc ?? null;
  if (t.refresh_token) refreshEnc = encrypt(t.refresh_token, keyRing(), aad(userId, row.id, "refresh"));
  if (!refreshEnc) throw new GmailAuthError("Google did not return a refresh token; revoke app access in your Google account and retry");
  await prisma.connectedEmailAccount.update({
    where: { id: row.id },
    data: { status: "ACTIVE", scopes: GMAIL_SCOPE, refreshTokenEnc: refreshEnc, accessTokenEnc: encrypt(t.access_token, keyRing(), aad(userId, row.id, "access")),
      accessTokenExpiresAt: new Date(Date.now() + t.expires_in * 1000), lastError: null, disconnectedAt: null },
  });
  return emailAddress;
}
export const getConnection = (userId: string) => prisma.connectedEmailAccount.findFirst({ where: { userId, provider: "gmail" }, orderBy: { connectedAt: "desc" } });

async function accessToken(userId: string, force = false) {
  const acct = await getConnection(userId);
  if (!acct || acct.status === "DISCONNECTED" || !acct.refreshTokenEnc) throw new NotConnectedError("Gmail is not connected");
  if (acct.status === "NEEDS_REAUTH") throw new GmailAuthError("Gmail needs to be reconnected");
  if (!force && acct.accessTokenEnc && acct.accessTokenExpiresAt && acct.accessTokenExpiresAt.getTime() > Date.now() + 60_000)
    return { token: decrypt(acct.accessTokenEnc, keyRing(), aad(userId, acct.id, "access")), acct };
  try {
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: decrypt(acct.refreshTokenEnc, keyRing(), aad(userId, acct.id, "refresh")) });
    await prisma.connectedEmailAccount.updateMany({ where: { id: acct.id, userId }, data: {
      accessTokenEnc: encrypt(t.access_token, keyRing(), aad(userId, acct.id, "access")), accessTokenExpiresAt: new Date(Date.now() + t.expires_in * 1000), lastError: null } });
    return { token: t.access_token, acct };
  } catch (e: any) {
    if (e.oauthError === "invalid_grant") { // revoked / expired (e.g. 7-day expiry for apps in Google "Testing" mode)
      await prisma.connectedEmailAccount.updateMany({ where: { id: acct.id, userId }, data: { status: "NEEDS_REAUTH", lastError: "invalid_grant" } });
      throw new GmailAuthError("Gmail access was revoked or expired; reconnect required");
    }
    throw e;
  }
}
async function gmailGet(userId: string, path: string, retried = false): Promise<any> {
  const { token } = await accessToken(userId, retried);
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
  if (res.status === 401 && !retried) return gmailGet(userId, path, true);
  if (res.status === 429 || (res.status === 403 && /rateLimit|quota/i.test(await res.clone().text()))) throw new GmailRateLimitError("Gmail rate limit; try again shortly");
  if (!res.ok) { log("warn", "gmail_http_error", { status: res.status }); throw new Error(`Gmail API ${res.status}`); }
  return res.json();
}
export interface MailListItem { id: string; threadId: string; subject: string; senderName: string; senderEmail: string; snippet: string; receivedAt: string; permalink: string; summarized?: boolean }

/** Bounded: at most `max` (<=25) recent inbox messages, metadata only. */
export async function listRecent(userId: string, max = 15): Promise<MailListItem[]> {
  const { acct } = await accessToken(userId);
  const list = await gmailGet(userId, `/messages?maxResults=${Math.min(max, 25)}&labelIds=INBOX&q=${encodeURIComponent("newer_than:14d")}`);
  const ids: string[] = (list.messages ?? []).map((m: any) => m.id);
  const out: MailListItem[] = [];
  for (let i = 0; i < ids.length; i += 5) {
    const batch = await Promise.all(ids.slice(i, i + 5).map((id) => gmailGet(userId, `/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`)));
    for (const m of batch) {
      const from = parseFrom(header(m.payload, "From"));
      out.push({ id: m.id, threadId: m.threadId, subject: truncate(safeText(header(m.payload, "Subject")) || "(no subject)", 200), senderName: from.name, senderEmail: from.email,
        snippet: truncate(safeText(m.snippet ?? ""), 200), receivedAt: new Date(Number(m.internalDate)).toISOString(), permalink: gmailPermalink(m.id, acct.emailAddress) });
    }
  }
  return out;
}
export async function fetchMessage(userId: string, id: string) {
  if (!/^[0-9a-f]{8,32}$/i.test(id)) throw new Error("Invalid message id");
  const { acct } = await accessToken(userId);
  const m = await gmailGet(userId, `/messages/${id}?format=full`);
  const from = parseFrom(header(m.payload as GmailPart, "From"));
  return { id: m.id as string, threadId: m.threadId as string, subject: truncate(safeText(header(m.payload, "Subject")) || "(no subject)", 200), senderName: from.name, senderEmail: from.email,
    snippet: truncate(safeText(m.snippet ?? ""), 200), body: extractBody(m.payload as GmailPart, 8_000), receivedAt: new Date(Number(m.internalDate)), permalink: gmailPermalink(m.id, acct.emailAddress), connectedAccountId: acct.id };
}
/** Best-effort revoke at Google, then wipe tokens locally and the stored email bodies for this mailbox. */
export async function disconnect(userId: string) {
  const acct = await getConnection(userId);
  if (!acct) return;
  if (acct.refreshTokenEnc) {
    try {
      const rt = decrypt(acct.refreshTokenEnc, keyRing(), aad(userId, acct.id, "refresh"));
      await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: rt }), signal: AbortSignal.timeout(10_000) });
    } catch { log("warn", "gmail_revoke_failed"); }
  }
  await prisma.connectedEmailAccount.updateMany({ where: { id: acct.id, userId }, data: { status: "DISCONNECTED", accessTokenEnc: null, refreshTokenEnc: null, accessTokenExpiresAt: null, disconnectedAt: new Date() } });
  await prisma.emailRecord.updateMany({ where: { userId, connectedAccountId: acct.id }, data: { bodyText: null } });
  await prisma.syncCheckpoint.deleteMany({ where: { accountId: acct.id } });
}
