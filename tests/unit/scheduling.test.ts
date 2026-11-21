import test from "node:test";
import assert from "node:assert/strict";
import { isDigestDue } from "../../src/worker/index.ts";
import { isPriorityEligible } from "../../src/lib/gmail-sync.ts";
import { composeDigestBody } from "../../src/lib/compose.ts";

test("isDigestDue respects user timezone and time of day", () => {
  // 08:30 Kampala is 05:30 UTC
  const at830Kampala = new Date(Date.UTC(2026, 9, 31, 5, 30));
  // 07:30 Kampala is 04:30 UTC
  const at730Kampala = new Date(Date.UTC(2026, 9, 31, 4, 30));

  // Case 1: Time has reached 08:00, never sent before -> DUE
  const res1 = isDigestDue({ timezone: "Africa/Kampala", digestTime: "08:00", lastDigestSentAt: null }, at830Kampala);
  assert.equal(res1.due, true);
  assert.equal(res1.dateStr, "2026-10-31");

  // Case 2: Time has not reached 08:00 yet -> NOT DUE
  const res2 = isDigestDue({ timezone: "Africa/Kampala", digestTime: "08:00", lastDigestSentAt: null }, at730Kampala);
  assert.equal(res2.due, false);

  // Case 3: Already sent earlier today (e.g. at 08:05 Kampala) -> NOT DUE
  const sentToday = new Date(Date.UTC(2026, 9, 31, 5, 5));
  const res3 = isDigestDue({ timezone: "Africa/Kampala", digestTime: "08:00", lastDigestSentAt: sentToday }, at830Kampala);
  assert.equal(res3.due, false);

  // Case 4: Sent yesterday -> DUE
  const sentYesterday = new Date(Date.UTC(2026, 9, 30, 5, 5));
  const res4 = isDigestDue({ timezone: "Africa/Kampala", digestTime: "08:00", lastDigestSentAt: sentYesterday }, at830Kampala);
  assert.equal(res4.due, true);
});

test("isPriorityEligible correctly ranks priority thresholds", () => {
  assert.equal(isPriorityEligible("URGENT", "HIGH"), true);
  assert.equal(isPriorityEligible("HIGH", "HIGH"), true);
  assert.equal(isPriorityEligible("NORMAL", "HIGH"), false);
  assert.equal(isPriorityEligible("LOW", "HIGH"), false);

  assert.equal(isPriorityEligible("NORMAL", "NORMAL"), true);
  assert.equal(isPriorityEligible("LOW", "NORMAL"), false);

  assert.equal(isPriorityEligible("LOW", "LOW"), true);
  assert.equal(isPriorityEligible("URGENT", "URGENT"), true);
  assert.equal(isPriorityEligible("HIGH", "URGENT"), false);
});

test("composeDigestBody formats items with badges and actions", () => {
  const summaries = [
    {
      subject: "Overdue server payment",
      senderName: "Billing Dept",
      senderEmail: "billing@example.test",
      mainMessage: "Please pay immediately",
      requiredAction: "Pay invoice 55",
      deadlineText: "within 24 hours",
      priority: "URGENT",
    },
    {
      subject: "Weekly engineering newsletter",
      senderName: "Dev Team",
      senderEmail: "news@example.test",
      mainMessage: "Quarterly updates",
      requiredAction: null,
      deadlineText: null,
      priority: "LOW",
    },
  ];

  const body = composeDigestBody(summaries, "Oct 31");
  assert.match(body, /Daily Digest \(Oct 31\)/);
  assert.match(body, /You have 2 email summaries/);
  assert.match(body, /\[URGENT\] Billing Dept: Overdue server payment/);
  assert.match(body, /Action: Pay invoice 55/);
  assert.match(body, /Due: within 24 hours/);
  assert.match(body, /\[LOW\] Dev Team: Weekly engineering newsletter/);
});
