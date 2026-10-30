import { z } from "zod";
import { route, json, body } from "@/lib/http";
import { requestNotification } from "@/lib/notify";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const GET = route(async ({ user }) => json(await prisma.notificationAttempt.findMany({
  where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50,
  include: { summary: { select: { subject: true } }, events: { orderBy: { occurredAt: "asc" }, select: { status: true, occurredAt: true } } } })));
export const POST = route(async ({ req, user }) => {
  const b = await body(req, (x) => z.object({ destinationId: z.string().min(1), kind: z.enum(["TEST", "SUMMARY"]), summaryId: z.string().optional() }).parse(x));
  const r = await requestNotification(user.id, b);
  return json({ attemptId: r.attempt.id, status: r.attempt.status, duplicate: r.duplicate }, r.duplicate ? 200 : 202);
});
