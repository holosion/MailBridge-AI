import { z } from "zod";
import { route, json, body, HttpError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { isValidTimeZone, parseHHmm } from "@/lib/quiet-hours";

const preferenceSchema = z.object({
  timezone: z.string(),
  quietHoursStart: z.string(),
  quietHoursEnd: z.string(),
  notificationsEnabled: z.boolean(),
  minPriority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional().default("HIGH"),
  digestEnabled: z.boolean().optional().default(true),
  digestTime: z.string().optional().default("08:00"),
  autoSyncEnabled: z.boolean().optional().default(true),
  syncIntervalMinutes: z.number().int().min(5).max(1440).optional().default(15),
});

export const dynamic = "force-dynamic";
export const GET = route(async ({ user }) => json(await prisma.notificationPreference.findUnique({ where: { userId: user.id } })));
export const PUT = route(async ({ req, user }) => {
  const b = await body(req, (x) => preferenceSchema.parse(x));
  if (!isValidTimeZone(b.timezone) || parseHHmm(b.quietHoursStart) === null || parseHHmm(b.quietHoursEnd) === null || parseHHmm(b.digestTime) === null) {
    throw new HttpError(400, "invalid_preferences", "Invalid timezone or time format (use HH:mm)");
  }
  return json(await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...b },
    update: b,
  }));
});

