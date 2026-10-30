import { z } from "zod";
import { route, json, body, HttpError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { isValidTimeZone, parseHHmm } from "@/lib/quiet-hours";

export const dynamic = "force-dynamic";
export const GET = route(async ({ user }) => json(await prisma.notificationPreference.findUnique({ where: { userId: user.id } })));
export const PUT = route(async ({ req, user }) => {
  const b = await body(req, (x) => z.object({ timezone: z.string(), quietHoursStart: z.string(), quietHoursEnd: z.string(), notificationsEnabled: z.boolean() }).parse(x));
  if (!isValidTimeZone(b.timezone) || parseHHmm(b.quietHoursStart) === null || parseHHmm(b.quietHoursEnd) === null) throw new HttpError(400, "invalid_preferences");
  return json(await prisma.notificationPreference.upsert({ where: { userId: user.id }, create: { userId: user.id, ...b }, update: b }));
});
