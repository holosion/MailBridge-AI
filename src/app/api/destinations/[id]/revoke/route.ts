import { route, json } from "@/lib/http";
import { revokeDestination } from "@/lib/notify";
export const POST = route(async ({ user, params }) => { await revokeDestination(user.id, params.id); return json({ ok: true }); });
