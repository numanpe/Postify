import "server-only";
import crypto from "node:crypto";

// Reset/invite tokens are already 256 bits of randomness — unlike a
// user-chosen password, there's nothing low-entropy to defend against by
// slowing the hash down, so a fast SHA-256 digest is the correct choice
// here (bcrypt's deliberate slowness in src/lib/password.ts exists
// specifically for human-guessable passwords). Only the hash is ever
// stored; the raw token exists only in the URL sent to the user's email
// and is never persisted anywhere.
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
