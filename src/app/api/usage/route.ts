import { route, json } from "@/lib/http";
import { getUsageStats } from "@/lib/usage";

export const dynamic = "force-dynamic";

export const GET = route(async ({ user }) => {
  const stats = await getUsageStats(user.id);
  return json(stats);
});
