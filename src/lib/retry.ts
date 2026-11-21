/** Exponential backoff: 30s, 60s, 120s ... capped at 15 min. `jitter` in [0,1) adds up to 20%. */
export function backoffMs(attempt: number, jitter = Math.random()): number {
  const base = Math.min(30_000 * 2 ** Math.max(0, attempt - 1), 15 * 60_000);
  return Math.round(base * (1 + 0.2 * jitter));
}
export type AttemptStatus = "PENDING" | "SENDING" | "ACCEPTED" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "UNKNOWN";
const RANK: Record<AttemptStatus, number> = { PENDING: 0, SENDING: 1, UNKNOWN: 1, ACCEPTED: 2, SENT: 3, DELIVERED: 4, READ: 5, FAILED: 9 };
/** Webhooks may arrive out of order/duplicated: only move forward. FAILED from a provider event applies unless already DELIVERED/READ. */
export function shouldAdvance(current: AttemptStatus, next: AttemptStatus): boolean {
  if (next === "FAILED") return current !== "DELIVERED" && current !== "READ" && current !== "FAILED";
  if (current === "FAILED") return false;
  return RANK[next] > RANK[current];
}
