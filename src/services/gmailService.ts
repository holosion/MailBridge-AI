import type { EmailMessage } from '../types/mailbridge';

export class GmailAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GmailAuthError';
  }
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPayloadPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayloadPart[];
}

interface GmailMessageResource {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: GmailHeader[];
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailPayloadPart[];
  };
}

function decodeBase64Url(input: string): string {
  try {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLength);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractBodyText(payload?: GmailMessageResource['payload']): string {
  if (!payload) return '';

  const findPart = (
    part: GmailPayloadPart | GmailMessageResource['payload'],
    targetMime: string
  ): string | null => {
    if (!part) return null;
    if (part.mimeType === targetMime && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
    if (part.parts) {
      for (const child of part.parts) {
        const found = findPart(child, targetMime);
        if (found) return found;
      }
    }
    return null;
  };

  const plainText = findPart(payload, 'text/plain');
  if (plainText && plainText.trim()) {
    return plainText.trim();
  }

  const htmlText = findPart(payload, 'text/html');
  if (htmlText && htmlText.trim()) {
    return stripHtmlTags(htmlText);
  }

  if (payload.body?.data) {
    const raw = decodeBase64Url(payload.body.data);
    return payload.mimeType === 'text/html' ? stripHtmlTags(raw) : raw.trim();
  }

  return '';
}

function parseSender(rawFrom: string): { senderName: string; senderEmail: string } {
  const match = rawFrom.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    const name = match[1].replace(/^"|"$/g, '').trim();
    const email = match[2].trim();
    return { senderName: name || email, senderEmail: email };
  }
  const clean = rawFrom.trim();
  return { senderName: clean || 'Unknown Sender', senderEmail: clean };
}

function getHeader(headers: GmailHeader[] | undefined, name: string): string {
  if (!headers) return '';
  const found = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return found?.value ?? '';
}

export async function fetchRecentGmailMessages(
  accessToken: string,
  maxResults = 20,
  query = ''
): Promise<EmailMessage[]> {
  if (!accessToken) {
    throw new GmailAuthError('Gmail authorization is required to read your inbox.');
  }

  const params = new URLSearchParams({
    maxResults: String(maxResults),
  });
  if (query.trim()) {
    params.set('q', query.trim());
  } else {
    params.set('labelIds', 'INBOX');
  }

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (listRes.status === 401 || listRes.status === 403) {
    throw new GmailAuthError('Gmail access token expired or insufficient permission. Please reconnect Gmail.');
  }

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`Gmail API error (${listRes.status}): ${errText}`);
  }

  const listJson = (await listRes.json()) as { messages?: Array<{ id: string; threadId: string }> };
  const refs = listJson.messages ?? [];
  if (refs.length === 0) {
    return [];
  }

  const messages = await Promise.all(
    refs.slice(0, maxResults).map(async (ref): Promise<EmailMessage | null> => {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(ref.id)}?format=full`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!detailRes.ok) return null;
      const msg = (await detailRes.json()) as GmailMessageResource;
      const headers = msg.payload?.headers;
      const rawFrom = getHeader(headers, 'From');
      const { senderName, senderEmail } = parseSender(rawFrom);
      const subject = getHeader(headers, 'Subject') || '(No subject)';
      const dateHeader = getHeader(headers, 'Date');
      const receivedIso = msg.internalDate
        ? new Date(Number(msg.internalDate)).toISOString()
        : dateHeader
          ? new Date(dateHeader).toISOString()
          : new Date().toISOString();

      const bodyText = extractBodyText(msg.payload) || msg.snippet || '';
      const labels = msg.labelIds ?? [];

      return {
        messageId: msg.id,
        threadId: msg.threadId || msg.id,
        senderName,
        senderEmail,
        subject,
        snippet: msg.snippet || bodyText.slice(0, 180),
        bodyText,
        receivedAt: receivedIso,
        isUnread: labels.includes('UNREAD'),
        isDemo: false,
        labels,
      };
    })
  );

  return messages.filter((m): m is EmailMessage => m !== null);
}
