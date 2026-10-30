import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./db.ts";
import { env } from "./env.ts";

const e = env();
// Sign-in identity only. Gmail DATA access is a separate, explicit consent flow (src/lib/gmail.ts) with its own encrypted tokens.
export const auth = betterAuth({
  baseURL: e.APP_URL,
  secret: e.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, minPasswordLength: 12, autoSignIn: true },
  socialProviders: e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET ? { google: { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET } } : {},
  plugins: [nextCookies()],
});
