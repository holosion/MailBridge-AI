// AES-256-GCM envelope with a versioned key ring. Pure (node:crypto only) so it is unit-testable.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface KeyRing { current: number; keys: Map<number, Buffer> }

export function parseKeyRing(spec: string, current: number): KeyRing {
  const keys = new Map<number, Buffer>();
  for (const part of spec.split(",").map((s) => s.trim()).filter(Boolean)) {
    const i = part.indexOf(":");
    if (i < 1) throw new Error("ENCRYPTION_KEYS entries must look like <version>:<base64 32-byte key>");
    const version = Number(part.slice(0, i));
    const key = Buffer.from(part.slice(i + 1), "base64");
    if (!Number.isInteger(version) || version < 1) throw new Error("Invalid key version in ENCRYPTION_KEYS");
    if (key.length !== 32) throw new Error(`Key v${version} must decode to exactly 32 bytes`);
    keys.set(version, key);
  }
  if (!keys.has(current)) throw new Error(`ENCRYPTION_KEY_CURRENT=${current} not present in ENCRYPTION_KEYS`);
  return { current, keys };
}

/** Output: v1.<keyVersion>.<iv>.<tag>.<ciphertext> (base64url parts). `aad` binds the ciphertext to its record. */
export function encrypt(plaintext: string, ring: KeyRing, aad: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", ring.keys.get(ring.current)!, iv);
  c.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return ["v1", ring.current, iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decrypt(payload: string, ring: KeyRing, aad: string): string {
  const p = payload.split(".");
  if (p.length !== 5 || p[0] !== "v1") throw new Error("Unrecognized ciphertext format");
  const key = ring.keys.get(Number(p[1]));
  if (!key) throw new Error(`No key available for version ${p[1]}`);
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(p[2], "base64url"));
  d.setAAD(Buffer.from(aad, "utf8"));
  d.setAuthTag(Buffer.from(p[3], "base64url"));
  return Buffer.concat([d.update(Buffer.from(p[4], "base64url")), d.final()]).toString("utf8");
}

export function needsRotation(payload: string, ring: KeyRing): boolean {
  return Number(payload.split(".")[1]) !== ring.current;
}
