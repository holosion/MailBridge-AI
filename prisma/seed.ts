// SYNTHETIC SEED DATA ONLY: invented users, example.test addresses, fake phone numbers. No real emails, tokens or credentials.
// Seeded users have NO login credentials. To see seeded data in the UI set SEED_FOR_EMAIL to an account you already signed up with.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function seedUser(id: string, email: string, name: string, phone: string) {
  const user = await prisma.user.upsert({ where: { email }, update: {}, create: { id, email, name, emailVerified: true } });
  await prisma.notificationPreference.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id, timezone: "Africa/Kampala" } });
  const dest = await prisma.notificationDestination.upsert({ where: { channel_e164: { channel: "whatsapp", e164: phone } }, update: {},
    create: { userId: user.id, e164: phone, status: "VERIFIED", verifiedAt: new Date(), verificationMethod: "seed_synthetic" } });
  if (!(await prisma.consentRecord.findFirst({ where: { destinationId: dest.id } }))) await prisma.consentRecord.create({ data: { userId: user.id, destinationId: dest.id, textVersion: "2026-10-v1", source: "seed_synthetic" } });
  const rec = await prisma.emailRecord.upsert({ where: { userId_provider_providerMessageId: { userId: user.id, provider: "gmail", providerMessageId: `demo-seed-${id}` } }, update: {},
    create: { userId: user.id, providerMessageId: `demo-seed-${id}`, subject: `Synthetic: workshop sign-up for ${name}`, senderEmail: "events@example.test", senderName: "Events Desk", snippet: "Please confirm attendance",
      bodyText: "Please confirm your attendance by Monday 10 November.", receivedAt: new Date(Date.now() - 7_200_000), permalink: "demo://seed", isDemo: true } });
  const sum = await prisma.summary.upsert({ where: { emailRecordId_promptVersion: { emailRecordId: rec.id, promptVersion: "v1" } }, update: {},
    create: { userId: user.id, emailRecordId: rec.id, subject: rec.subject, senderName: rec.senderName, senderEmail: rec.senderEmail, providerMessageId: rec.providerMessageId, permalink: rec.permalink,
      mainMessage: "An events desk asks you to confirm attendance at a workshop.", requiredAction: "Confirm your attendance", deadlineText: "Monday 10 November", deadlineEvidence: "by Monday 10 November",
      priority: "NORMAL", priorityReason: "Has a stated deadline but is routine.", aiProvider: "seed", aiModel: "synthetic", promptVersion: "v1", isDemo: true } });
  await prisma.notificationAttempt.upsert({ where: { requestKey: `seed:${id}` }, update: {},
    create: { userId: user.id, destinationId: dest.id, summaryId: sum.id, kind: "SUMMARY", mode: "TEMPLATE", status: "DELIVERED", requestKey: `seed:${id}`, providerName: "mock", providerMessageId: `demo.seed.${id}`, isDemo: true } });
  return user;
}
async function main() {
  await seedUser("seed-alice", "alice@example.test", "Alice (synthetic)", "+15550100001");
  await seedUser("seed-bob", "bob@example.test", "Bob (synthetic)", "+15550100002");
  const target = process.env.SEED_FOR_EMAIL;
  if (target) {
    const u = await prisma.user.findUnique({ where: { email: target } });
    if (u) await seedUser(u.id, u.email, "You", "+15550100003"); else console.log(`SEED_FOR_EMAIL=${target} has not signed up yet; skipped.`);
  }
  console.log("Seeded synthetic users alice@example.test and bob@example.test (no credentials).");
}
main().finally(() => prisma.$disconnect());
