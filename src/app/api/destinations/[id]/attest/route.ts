import { route, json } from "@/lib/http";
import { attestDestination } from "@/lib/notify";
export const POST = route(async ({ user, params }) => { await attestDestination(user.id, params.id); return json({ ok: true }); });
