import { z } from "zod";
import { route, json, body, HttpError } from "@/lib/http";
import { summarizeEmail } from "@/lib/summarize";
import { prisma } from "@/lib/db";
import { GmailAuthError, GmailRateLimitError, NotConnectedError } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const GET = route(async ({ user }) => json(await prisma.summary.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 })));
export const POST = route(async ({ req, user }) => {
  const { messageId } = await body(req, (x) => z.object({ messageId: z.string().min(1).max(64) }).parse(x));
  try { return json(await summarizeEmail(user.id, messageId), 201); }
  catch (e) {
    if (e instanceof NotConnectedError) throw new HttpError(409, "gmail_not_connected");
    if (e instanceof GmailAuthError) throw new HttpError(409, "gmail_needs_reauth", e.message);
    if (e instanceof GmailRateLimitError) throw new HttpError(429, "gmail_rate_limited", e.message);
    if (e instanceof Error && /AI provider|valid JSON|No JSON|missing|invalid/i.test(e.message)) throw new HttpError(502, "summary_failed", "The summary could not be generated; try again");
    throw e;
  }
});
