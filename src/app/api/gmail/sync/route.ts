import { route, json } from "@/lib/http";
import { syncGmailAccount } from "@/lib/gmail-sync";

export const dynamic = "force-dynamic";

export const POST = route(async ({ user }) => {
  const result = await syncGmailAccount(user.id);
  return json(result);
});
