import test from "node:test";
import assert from "node:assert/strict";
import { buildInboxQuery } from "../../src/lib/gmail.ts";
import { htmlToText, safeText } from "../../src/lib/sanitize.ts";
import { extractBody, parseFrom, decodeBase64Url } from "../../src/lib/gmail-parse.ts";
import { parseModelJson, validateSummary, SummaryValidationError } from "../../src/lib/summary-validate.ts";
import { templateParams, textBody } from "../../src/lib/compose.ts";

const b64 = (s: string) => Buffer.from(s).toString("base64url");

test("htmlToText strips scripts, tags, entities and bidi/zero-width chars", () => {
  const out = htmlToText('<p>Hi&nbsp;&amp; bye</p><script>alert(1)</script><img src=x onerror=alert(2)>\u202Eevil\u200B');
  assert.ok(!/script|alert|<|onerror/.test(out.replace("evil", "")), out);
  assert.ok(out.includes("Hi & bye") && out.includes("evil"));
  assert.equal(safeText("a\u0000b\u202Ec"), "abc");
});
test("extractBody prefers text/plain, falls back to html, skips attachments", () => {
  const multi = { mimeType: "multipart/alternative", parts: [
    { mimeType: "text/plain", body: { data: b64("plain body") } },
    { mimeType: "text/html", body: { data: b64("<b>html body</b>") } },
    { mimeType: "text/plain", filename: "a.txt", body: { data: b64("ATTACHMENT") } } ] };
  assert.equal(extractBody(multi), "plain body");
  assert.equal(extractBody({ mimeType: "text/html", body: { data: b64("<div>only <i>html</i></div>") } }), "only html");
  assert.equal(decodeBase64Url(b64("héllo")), "héllo");
});
test("parseFrom handles display names, bare addresses, quotes", () => {
  assert.deepEqual(parseFrom('"Dr. Okello" <Okello@Example.test>'), { name: "Dr. Okello", email: "okello@example.test" });
  assert.deepEqual(parseFrom("bare@example.test"), { name: "", email: "bare@example.test" });
});

test("Gmail incremental query uses a valid persisted cursor", () => {
  assert.equal(buildInboxQuery(null), "newer_than:14d");
  assert.equal(buildInboxQuery("1760000000000"), "newer_than:14d after:1760000000");
  assert.equal(buildInboxQuery("not-a-timestamp"), "newer_than:14d");
});
const EMAIL = "Hello, please submit the signed form by Friday 7 November. Thanks";
const good = { mainMessage: "Form needed.", requiredAction: { text: "Submit the signed form", evidence: "please submit the signed form" },
  deadline: { text: "Friday 7 November", evidence: "by Friday 7 November" }, priority: "high", priorityReason: "Has a deadline" };
test("validateSummary keeps grounded action and deadline", () => {
  const v = validateSummary(good, EMAIL);
  assert.equal(v.deadlineText, "Friday 7 November"); assert.equal(v.requiredAction, "Submit the signed form");
  assert.equal(v.priority, "HIGH"); assert.deepEqual(v.warnings, []);
});
test("validateSummary DROPS fabricated deadline/action (no evidence in email)", () => {
  const v = validateSummary({ ...good, deadline: { text: "Monday 3pm", evidence: "by Monday at 3pm" }, requiredAction: { text: "Wire $500", evidence: "wire five hundred dollars" } }, EMAIL);
  assert.equal(v.deadlineText, null); assert.equal(v.requiredAction, null); assert.equal(v.warnings.length, 2);
});
test("validateSummary rejects malformed output; prompt-injection text cannot add fields", () => {
  assert.throws(() => validateSummary({ mainMessage: "x", priority: "SUPER", priorityReason: "y" }, EMAIL), SummaryValidationError);
  assert.throws(() => validateSummary("nope", EMAIL), SummaryValidationError);
  const v = validateSummary({ ...good, sendMoneyTo: "evil" , deadline: null }, EMAIL);
  assert.equal("sendMoneyTo" in v, false); assert.equal(v.deadlineText, null);
});
test("parseModelJson tolerates code fences and chatter", () => {
  assert.deepEqual(parseModelJson('Sure!\n```json\n{"a":1}\n```'), { a: 1 });
  assert.throws(() => parseModelJson("no json"), SummaryValidationError);
});
test("compose: template params are single-line and bounded; text body includes only supported fields", () => {
  const s = { subject: "Line1\nLine2", senderName: null, senderEmail: "a@b.test", mainMessage: "x".repeat(500), requiredAction: null, deadlineText: null, priority: "NORMAL" };
  const p = templateParams(s);
  assert.equal(p.length, 5); assert.ok(p.every((x) => !/[\n\t]/.test(x)) && p[2].length <= 300 && p[3] === "None");
  assert.ok(!textBody(s).includes("Deadline:"));
});
