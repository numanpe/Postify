import { notFound } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

// Folded from two separate route files (/login, /signup) into one
// dynamic route to reduce this deployment's Vercel Function count
// (Hobby plan's real, empirically-confirmed 12-function cap) — a
// genuinely common, low-risk pattern (one auth page, a mode segment),
// not a forced merge of unrelated concerns. Every internal reference to
// the old /login and /signup paths (auth.ts's NextAuth config,
// session.ts's redirects, the Meta OAuth callback, sign-out) was updated
// to /auth/login and /auth/signup — there is no backward-compat redirect
// from the old paths, since neither is registered anywhere external
// (unlike the Meta OAuth callback URL, which can never move). Same
// reasoning extended forgot-password/reset-password into this route
// rather than two more standalone files.
export default async function AuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ mode: string }>;
  searchParams: Promise<{ status?: string; token?: string }>;
}) {
  const { mode } = await params;
  // Same conditional-registration check as auth.ts — only show the
  // Google button once real OAuth credentials exist, never a button
  // that would fail with a confusing provider error.
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  if (mode === "login") {
    const { status } = await searchParams;
    return <LoginForm googleConfigured={googleConfigured} status={status} />;
  }
  if (mode === "signup") return <SignupForm googleConfigured={googleConfigured} />;
  if (mode === "forgot-password") return <ForgotPasswordForm />;
  if (mode === "reset-password") {
    const { token } = await searchParams;
    if (!token) notFound();
    return <ResetPasswordForm token={token} />;
  }
  notFound();
}
