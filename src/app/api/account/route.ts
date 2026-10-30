import { z } from "zod";
import { route, json, body, HttpError } from "@/lib/http";
import { disconnect } from "@/lib/gmail";
import { prisma } from "@/lib/db";

// Account deletion: revoke Google access (best effort), then hard-delete the user. Every owned table cascades (see migration).
export const DELETE = route(async ({ req, user }) => {
  const b = await body(req, (x) => z.object({ confirmEmail: z.string() }).parse(x));
  if (b.confirmEmail.toLowerCase() !== user.email.toLowerCase()) throw new HttpError(400, "confirmation_mismatch");
  await disconnect(user.id);
  await prisma.user.delete({ where: { id: user.id } });
  return json({ ok: true });
});
