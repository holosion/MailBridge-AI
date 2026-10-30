// REQUIRES a migrated PostgreSQL (DATABASE_URL) and the env vars from .env.example. Skipped otherwise.
// Run: npm run test:integration
import test from "node:test";
import assert from "node:assert/strict";

const ready = !!(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET && process.env.ENCRYPTION_KEYS && process.env.APP_URL);
const t = ready ? test : test.skip;

t("users cannot see or act on each other's records", async () => {
  const { prisma } = await import("../../src/lib/db.ts");
  const n = await import("../../src/lib/notify.ts");
  const tag = Date.now().toString(36);
  const mk = async (name: string, phone: string) => {
    const u = await prisma.user.create({ data: { id: `it-${name}-${tag}`, email: `${name}-${tag}@example.test`, name } });
    const d = await prisma.notificationDestination.create({ data: { userId: u.id, e164: phone, status: "VERIFIED", verifiedAt: new Date() } });
    await prisma.consentRecord.create({ data: { userId: u.id, destinationId: d.id, textVersion: "t", source: "test" } });
    const s = await prisma.summary.create({ data: { userId: u.id, subject: "s", senderEmail: "a@example.test", providerMessageId: `m-${name}-${tag}`, permalink: "x", mainMessage: "m", priority: "LOW", priorityReason: "r", aiProvider: "t", aiModel: "t", promptVersion: "v1" } });
    return { u, d, s };
  };
  const a = await mk("alice", `+1555${tag.replace(/\D/g, "").padEnd(7, "1").slice(0, 7)}`), b = await mk("bob", `+1556${tag.replace(/\D/g, "").padEnd(7, "2").slice(0, 7)}`);
  try {
    await assert.rejects(n.requestNotification(a.u.id, { destinationId: b.d.id, kind: "TEST" }), { code: "destination_not_found" });                      // other user's destination
    await assert.rejects(n.requestNotification(a.u.id, { destinationId: a.d.id, kind: "SUMMARY", summaryId: b.s.id }), { code: "summary_not_found" }); // other user's summary
    const own = await n.requestNotification(a.u.id, { destinationId: a.d.id, kind: "SUMMARY", summaryId: a.s.id });
    assert.equal(own.duplicate, false);
    const again = await n.requestNotification(a.u.id, { destinationId: a.d.id, kind: "SUMMARY", summaryId: a.s.id });
    assert.equal(again.duplicate, true); assert.equal(again.attempt.id, own.attempt.id);                                                              // idempotent
    await prisma.notificationAttempt.update({ where: { id: own.attempt.id }, data: { status: "UNKNOWN" } });
    await assert.rejects(n.resolveUnknown(b.u.id, own.attempt.id, "received"), { code: "attempt_not_found_or_not_unknown" });                          // bob cannot resolve alice's attempt
    assert.equal(await prisma.summary.count({ where: { userId: b.u.id, id: a.s.id } }), 0);
    // account deletion cascades
    await prisma.user.delete({ where: { id: a.u.id } });
    assert.equal(await prisma.notificationAttempt.count({ where: { userId: a.u.id } }), 0);
    assert.equal(await prisma.summary.count({ where: { userId: a.u.id } }), 0);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [a.u.id, b.u.id] } } });
    await prisma.$disconnect();
  }
});
