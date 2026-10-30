import { route, json, HttpError } from "@/lib/http";
import { listEmailsForUser } from "@/lib/summarize";
import { GmailAuthError, GmailRateLimitError, NotConnectedError } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const GET = route(async ({ user }) => {
  try { return json(await listEmailsForUser(user.id)); }
  catch (e) {
    if (e instanceof NotConnectedError) throw new HttpError(409, "gmail_not_connected");
    if (e instanceof GmailAuthError) throw new HttpError(409, "gmail_needs_reauth", e.message);
    if (e instanceof GmailRateLimitError) throw new HttpError(429, "gmail_rate_limited", e.message);
    throw e;
  }
});
