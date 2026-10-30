import test from "node:test";
import assert from "node:assert/strict";
import { backoffMs, shouldAdvance } from "../../src/lib/retry.ts";
import { inQuietHours, nextQuietEnd, isValidTimeZone, parseHHmm } from "../../src/lib/quiet-hours.ts";

test("backoff grows exponentially, is capped and jitter-bounded", () => {
  assert.equal(backoffMs(1, 0), 30_000); assert.equal(backoffMs(2, 0), 60_000);
  assert.equal(backoffMs(20, 0), 900_000); assert.equal(backoffMs(1, 0.999) <= 36_000, true);
});
test("delivery status only moves forward (duplicate / out-of-order webhooks)", () => {
  assert.equal(shouldAdvance("ACCEPTED", "SENT"), true);
  assert.equal(shouldAdvance("DELIVERED", "SENT"), false);
  assert.equal(shouldAdvance("READ", "DELIVERED"), false);
  assert.equal(shouldAdvance("DELIVERED", "DELIVERED"), false);
  assert.equal(shouldAdvance("SENT", "FAILED"), true);
  assert.equal(shouldAdvance("DELIVERED", "FAILED"), false);
  assert.equal(shouldAdvance("FAILED", "DELIVERED"), false);
  assert.equal(shouldAdvance("UNKNOWN", "DELIVERED"), true);
});
test("quiet hours: overnight window in the user's timezone", () => {
  const utc = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 30, h, m));
  // Kampala is UTC+3: 20:00Z = 23:00 local (quiet), 05:00Z = 08:00 local (not quiet)
  assert.equal(inQuietHours(utc(20), "Africa/Kampala", "22:00", "07:00"), true);
  assert.equal(inQuietHours(utc(5), "Africa/Kampala", "22:00", "07:00"), false);
  assert.equal(inQuietHours(utc(3, 59), "Africa/Kampala", "22:00", "07:00"), true); // 06:59 local
  assert.equal(inQuietHours(utc(4), "Africa/Kampala", "22:00", "07:00"), false);    // 07:00 local
  assert.equal(inQuietHours(utc(20), "Africa/Kampala", "00:00", "00:00"), false);   // disabled
  assert.equal(inQuietHours(utc(12), "UTC", "09:00", "17:00"), true);               // same-day window
});
test("nextQuietEnd lands on the end boundary", () => {
  const now = new Date(Date.UTC(2026, 9, 30, 20, 0)); // 23:00 Kampala
  assert.equal(nextQuietEnd(now, "Africa/Kampala", "07:00").toISOString(), "2026-10-31T04:00:00.000Z");
});
test("timezone / HH:mm validation", () => {
  assert.equal(isValidTimeZone("Africa/Kampala"), true); assert.equal(isValidTimeZone("Mars/Base"), false);
  assert.equal(parseHHmm("24:00"), null); assert.equal(parseHHmm("07:30"), 450);
});
