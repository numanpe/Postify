import "server-only";
import crypto from "node:crypto";

// Stateless HMAC token (not a DB-backed one like password-reset-tokens.ts)
// — an unsubscribe link's action is idempotent and never expires, so
// there's no real value in a stored, revocable, expiring token the way a
// one-time password-reset credential needs. Signed with AUTH_SECRET
// (already required for real auth, reused rather than adding a second
// app-wide secret for one feature).
function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    throw new Error("AUTH_SECRET is not set — required to sign unsubscribe links.");
  }
  return s;
}

export function signUnsubscribeToken(companyId: string): string {
  return crypto.createHmac("sha256", secret()).update(companyId).digest("hex");
}

export function verifyUnsubscribeToken(companyId: string, token: string): boolean {
  const expected = Buffer.from(signUnsubscribeToken(companyId), "hex");
  const given = Buffer.from(token, "hex");
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
