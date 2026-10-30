import { z } from "zod";
import { route, json, body, HttpError } from "@/lib/http";
import { disconnect } from "@/lib/gmail";
import { prisma } from "@/lib/db";

// Account deletion: revoke Google access (best effort), then hard-delete the user. Every owned table cascades (see migration).
export const DELETE = route(async ({ req, user }) => {
  const b = await body(req, (x) => z.object({ confirmEmail: z.string() }).parse(x));
  if (b.confirmEmail.toLowerCase().trim() !== user.email.toLowerCase().trim()) throw new HttpError(400, "confirmation_mismatch", "Confirmation email does not match your account email");
  await disconnect(user.id);
  await prisma.consentRecord.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  await prisma.notificationDestination.updateMany({ where: { userId: user.id }, data: { status: "REVOKED" } });
  await prisma.user.delete({ where: { id: user.id } });
  return json({ ok: true });
});
