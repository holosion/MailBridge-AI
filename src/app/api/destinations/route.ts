import { z } from "zod";
import { route, json, body } from "@/lib/http";
import { addDestination } from "@/lib/notify";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const GET = route(async ({ user }) => json(await prisma.notificationDestination.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } })));
export const POST = route(async ({ req, user }) => {
  const b = await body(req, (x) => z.object({ phone: z.string().max(32), consent: z.boolean() }).parse(x));
  return json(await addDestination(user.id, b.phone, b.consent), 201);
});
