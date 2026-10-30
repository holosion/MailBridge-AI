import { z } from "zod";
import { route, json, body } from "@/lib/http";
import { resolveUnknown } from "@/lib/notify";
export const POST = route(async ({ req, user, params }) => {
  const { outcome } = await body(req, (x) => z.object({ outcome: z.enum(["received", "not_received"]) }).parse(x));
  await resolveUnknown(user.id, params.id, outcome);
  return json({ ok: true });
});
