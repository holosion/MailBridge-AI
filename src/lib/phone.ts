/** Returns E.164 ("+" and 8-15 digits, first digit non-zero) or null. */
export function normalizeE164(input: string): string | null {
  const cleaned = input.trim().replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(cleaned) ? cleaned : null;
}
export const toWhatsAppId = (e164: string) => e164.replace(/^\+/, "");
export const maskPhone = (e164: string) => (e164.length <= 6 ? "***" : `${e164.slice(0, 4)}${"*".repeat(e164.length - 6)}${e164.slice(-2)}`);
