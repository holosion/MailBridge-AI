import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth.ts";

export async function requireUser() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) redirect("/login");
  return s.user;
}
