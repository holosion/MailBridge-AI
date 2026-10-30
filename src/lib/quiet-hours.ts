export function parseHHmm(s: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
export function localMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")!.value);
  const m = Number(parts.find((p) => p.type === "minute")!.value);
  return h * 60 + m;
}
export function isValidTimeZone(tz: string): boolean {
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; }
}
/** Quiet window [start, end). Overnight windows (e.g. 22:00-07:00) supported. start === end disables quiet hours. */
export function inQuietHours(now: Date, tz: string, start: string, end: string): boolean {
  const s = parseHHmm(start), e = parseHHmm(end);
  if (s === null || e === null || s === e) return false;
  const t = localMinutes(now, tz);
  return s < e ? t >= s && t < e : t >= s || t < e;
}
/** Approximate instant when quiet hours end (ignores DST edges; good enough for deferral). */
export function nextQuietEnd(now: Date, tz: string, end: string): Date {
  const e = parseHHmm(end) ?? 0;
  const delta = (e - localMinutes(now, tz) + 1440) % 1440 || 1;
  return new Date(now.getTime() + delta * 60_000);
}
