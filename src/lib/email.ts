import "server-only";
import { Resend } from "resend";

// Platform-wide transactional email (password reset, admin invites) —
// distinct from the per-company BYOK ProviderCredential system
// elsewhere in this app. There's one sender for the whole platform, so
// this is a single env var, not a per-company encrypted credential.
//
// RESEND_FROM_EMAIL defaults to Resend's own onboarding@resend.dev
// sandbox address, which their docs state is "for testing only" — it
// is NOT verified for arbitrary recipients in production. Real
// delivery to real users requires verifying a real owned domain in the
// Resend dashboard and setting RESEND_FROM_EMAIL to an address on it.
// Confirmed with the project owner (2026-08) that no domain exists yet
// — this sends in sandbox mode until one is verified. That's a real,
// disclosed limitation, not a silent gap: sendEmail() below still
// genuinely calls Resend and genuinely reports failure, it just can't
// promise arbitrary-recipient delivery yet.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "Postify <onboarding@resend.dev>";

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email sending is not configured (RESEND_API_KEY is not set).");
  }
}

export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new EmailNotConfiguredError();
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [params.to],
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    throw new Error(`Resend failed to send email: ${error.message}`);
  }
}
