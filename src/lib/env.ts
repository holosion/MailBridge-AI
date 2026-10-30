import { z } from "zod";
import { parseKeyRing, type KeyRing } from "./crypto.ts";

const blank = (v: unknown) => (v === "" ? undefined : v);
const opt = z.preprocess(blank, z.string().optional());
const flag = (d: string) => z.string().default(d).transform((v) => v === "true");
const num = (d: number) => z.preprocess(blank, z.coerce.number().int().positive().default(d));

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be >= 32 chars"),
  ENCRYPTION_KEYS: z.string().min(1),
  ENCRYPTION_KEY_CURRENT: z.preprocess(blank, z.coerce.number().int().positive().default(1)),
  DEMO_MODE: flag("true"),
  ALLOW_OWNER_ATTEST: flag("false"),
  GOOGLE_CLIENT_ID: opt, GOOGLE_CLIENT_SECRET: opt,
  AI_PROVIDER: z.enum(["mock", "anthropic"]).default("mock"),
  ANTHROPIC_API_KEY: opt, ANTHROPIC_MODEL: z.preprocess(blank, z.string().default("claude-haiku-5-5")),
  WHATSAPP_PROVIDER: z.enum(["mock", "cloud"]).default("mock"),
  WHATSAPP_ACCESS_TOKEN: opt, WHATSAPP_PHONE_NUMBER_ID: opt, WHATSAPP_APP_SECRET: opt, WHATSAPP_VERIFY_TOKEN: opt,
  WHATSAPP_API_VERSION: z.preprocess(blank, z.string().default("v23.0")),
  WHATSAPP_TEMPLATE_TEST: z.preprocess(blank, z.string().default("hello_world")),
  WHATSAPP_TEMPLATE_SUMMARY: opt,
  WHATSAPP_TEMPLATE_LANG: z.preprocess(blank, z.string().default("en_US")),
  WHATSAPP_LIVE_SEND_ALLOWLIST: z.preprocess(blank, z.string().default("")),
  MONTHLY_SUMMARY_LIMIT: num(200), MONTHLY_NOTIFICATION_LIMIT: num(100),
  RETENTION_BODY_DAYS: num(7), RETENTION_EMAIL_DAYS: num(90), RETENTION_HISTORY_DAYS: num(180),
}).superRefine((e, ctx) => {
  const need = (cond: boolean, keys: string[], why: string) => cond && keys.forEach((k) => { if (!(e as any)[k]) ctx.addIssue({ code: "custom", path: [k], message: `required ${why}` }); });
  need(e.AI_PROVIDER === "anthropic", ["ANTHROPIC_API_KEY"], "when AI_PROVIDER=anthropic");
  need(e.WHATSAPP_PROVIDER === "cloud", ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_APP_SECRET", "WHATSAPP_VERIFY_TOKEN"], "when WHATSAPP_PROVIDER=cloud");
  need(!e.DEMO_MODE, ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], "when DEMO_MODE=false");
});

export type Env = z.infer<typeof schema>;
let cached: Env | undefined, ring: KeyRing | undefined;
export function env(): Env {
  if (!cached) {
    const r = schema.safeParse(process.env);
    if (!r.success) throw new Error("Invalid environment: " + r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    cached = r.data;
  }
  return cached;
}
export function keyRing(): KeyRing { return (ring ??= parseKeyRing(env().ENCRYPTION_KEYS, env().ENCRYPTION_KEY_CURRENT)); }
