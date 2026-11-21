// Structured logs with automatic redaction. NEVER pass tokens/bodies; redaction is a safety net, not permission.
const SENSITIVE = /token|secret|authorization|password|key|cookie|body|code_verifier/i;
function redact(v: unknown, depth = 0): unknown {
  if (depth > 3 || v === null || typeof v !== "object") return typeof v === "string" && v.length > 300 ? v.slice(0, 300) + "…" : v;
  if (Array.isArray(v)) return v.slice(0, 10).map((x) => redact(x, depth + 1));
  return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, SENSITIVE.test(k) ? "[redacted]" : redact(x, depth + 1)]));
}
export function log(level: "info" | "warn" | "error", msg: string, ctx: Record<string, unknown> = {}) {
  console[level === "info" ? "log" : level](JSON.stringify({ t: new Date().toISOString(), level, msg, ...(redact(ctx) as object) }));
}
