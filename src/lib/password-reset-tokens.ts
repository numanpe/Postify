import "server-only";

import { db } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/token";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour, per the Part C2 spec

// Returns the raw token (only ever held in memory / the outgoing email
// link) — the DB only ever stores its hash, per src/lib/token.ts's
// convention. Shared by the real "forgot password" flow
// (src/lib/actions/password-reset.ts) and the Super Admin seed script —
// the seeded account's placeholder password hash is unusable by design,
// so it needs this exact same mechanism to get a real first password.
export async function createPasswordResetToken(userId: string): Promise<string> {
  const rawToken = generateToken();
  await db.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });
  return rawToken;
}
