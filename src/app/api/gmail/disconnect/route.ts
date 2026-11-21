import { route, json } from "@/lib/http";
import { disconnect } from "@/lib/gmail";
export const POST = route(async ({ user }) => { await disconnect(user.id); return json({ ok: true }); });
