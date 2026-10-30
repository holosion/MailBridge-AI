import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { parseKeyRing, encrypt, decrypt, needsRotation } from "../../src/lib/crypto.ts";
import { verifyMetaSignature } from "../../src/lib/webhook-signature.ts";
import { signState, verifyState, createPkce } from "../../src/lib/oauth-state.ts";
import { normalizeE164, maskPhone } from "../../src/lib/phone.ts";

const k = (n: number) => `${n}:${randomBytes(32).toString("base64")}`;

test("encrypt/decrypt round trip with AAD binding", () => {
  const ring = parseKeyRing(k(1), 1);
  const ct = encrypt("refresh-token-abc", ring, "user1:acct1:refresh");
  assert.ok(!ct.includes("refresh-token-abc"));
  assert.equal(decrypt(ct, ring, "user1:acct1:refresh"), "refresh-token-abc");
  assert.throws(() => decrypt(ct, ring, "user2:acct1:refresh"), "AAD mismatch must fail");
});
test("tampered ciphertext is rejected", () => {
  const ring = parseKeyRing(k(1), 1);
  const parts = encrypt("secret", ring, "a").split(".");
  parts[4] = Buffer.from("tampered").toString("base64url");
  assert.throws(() => decrypt(parts.join("."), ring, "a"));
});
test("key rotation: old data stays readable, needsRotation flags it", () => {
  const k1 = k(1), k2 = k(2);
  const old = encrypt("x", parseKeyRing(k1, 1), "a");
  const ring2 = parseKeyRing(`${k1},${k2}`, 2);
  assert.equal(decrypt(old, ring2, "a"), "x");
  assert.equal(needsRotation(old, ring2), true);
  assert.equal(needsRotation(encrypt("x", ring2, "a"), ring2), false);
});
test("bad key material is rejected", () => {
  assert.throws(() => parseKeyRing("1:c2hvcnQ=", 1));
  assert.throws(() => parseKeyRing(k(1), 2));
});
test("Meta webhook signature: valid, wrong secret, missing, malformed", () => {
  const body = JSON.stringify({ entry: [] });
  const good = "sha256=" + createHmac("sha256", "appsecret").update(body).digest("hex");
  assert.equal(verifyMetaSignature(body, good, "appsecret"), true);
  assert.equal(verifyMetaSignature(body, good, "other"), false);
  assert.equal(verifyMetaSignature(body + " ", good, "appsecret"), false);
  assert.equal(verifyMetaSignature(body, null, "appsecret"), false);
  assert.equal(verifyMetaSignature(body, "sha256=zz", "appsecret"), false);
  assert.equal(verifyMetaSignature(body, good, ""), false);
});
test("OAuth state: signed, expiring, tamper-evident", () => {
  const t = signState({ uid: "u1", nonce: "n", exp: Date.now() + 60_000 }, "s3cret");
  assert.equal(verifyState<any>(t, "s3cret")?.uid, "u1");
  assert.equal(verifyState(t, "wrong"), null);
  assert.equal(verifyState(signState({ exp: Date.now() - 1 }, "s3cret"), "s3cret"), null);
  assert.equal(verifyState(t.replace(/^./, "X"), "s3cret"), null);
  const p = createPkce();
  assert.ok(p.verifier.length >= 43 && p.challenge !== p.verifier);
});
test("E.164 validation and masking", () => {
  assert.equal(normalizeE164(" +256 700-123 456 "), "+256700123456");
  assert.equal(normalizeE164("0700123456"), null);
  assert.equal(normalizeE164("+0123456789"), null);
  assert.equal(normalizeE164("+12"), null);
  assert.equal(maskPhone("+256700123456"), "+256*******56");
});
