"use server";

import { z } from "zod";

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { hashToken } from "@/lib/token";
import { createPasswordResetToken } from "@/lib/password-reset-tokens";
import { sendEmail, EmailNotConfiguredError } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

function getAppUrl(): string {
  const url = process.env.APP_URL;
  if (!url) {
    throw new Error("APP_URL is not set — required to build the password-reset link.");
  }
  return url.replace(/\/$/, "");
}

export type PasswordResetRequestState = { status: "sent" } | { status: "error"; error: string } | undefined;

const RequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
});

// Always resolves to the same "sent" outcome regardless of whether the
// address is actually registered, and regardless of whether the real
// send attempt for a registered user succeeds — revealing either would
// turn this into an account-enumeration oracle. Real delivery failures
// (e.g. RESEND_API_KEY not set yet) are logged server-side, not hidden
// from the operator, just never surfaced to the caller.
export async function requestPasswordReset(
  _prevState: PasswordResetRequestState,
  formData: FormData,
): Promise<PasswordResetRequestState> {
  // IP-keyed, not email-keyed — checking it before the enumeration-safe
  // "always sent" logic below is fine precisely because it never depends
  // on whether the account exists.
  const rateLimit = await checkRateLimit("password-reset");
  if (!rateLimit.allowed) {
    return { status: "error", error: "Too many reset requests. Please try again later." };
  }

  const parsed = RequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, name: true },
  });

  if (user) {
    const rawToken = await createPasswordResetToken(user.id);
    const resetUrl = `${getAppUrl()}/auth/reset-password?token=${rawToken}`;

    try {
      await sendEmail({
        to: parsed.data.email,
        subject: "Reset your Postify password",
        html: `<p>Hi${user.name ? ` ${user.name}` : ""},</p>
<p>Click the link below to set a new password. This link expires in 1 hour and can only be used once.</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>`,
      });
    } catch (error) {
      if (error instanceof EmailNotConfiguredError) {
        // Never log the token/URL — it's a live, unhashed credential
        // that grants account takeover to anyone who can read server
        // logs. This does mean a real reset request is genuinely
        // unrecoverable while RESEND_API_KEY is unset (an admin has to
        // fix the config and have the user retry, not read the link out
        // of logs) — a deliberate security-over-convenience tradeoff,
        // not an oversight.
        console.warn(`[password-reset] Email not configured — reset request for user ${user.id} could not be delivered.`);
      } else {
        console.error("[password-reset] sendEmail failed:", error);
      }
    }
  }

  return { status: "sent" };
}

export type ResetPasswordState = { status: "success" } | { status: "error"; error: string } | undefined;

const ResetSchema = z.object({
  token: z.string().min(1, "Missing reset token."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
});

export async function resetPassword(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = ResetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { status: "error", error: "This reset link is invalid or has expired. Request a new one." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  return { status: "success" };
}
