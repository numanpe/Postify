import { notFound } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";

// Folded from two separate route files (/login, /signup) into one
// dynamic route to reduce this deployment's Vercel Function count
// (Hobby plan's real, empirically-confirmed 12-function cap) — a
// genuinely common, low-risk pattern (one auth page, a mode segment),
// not a forced merge of unrelated concerns. Every internal reference to
// the old /login and /signup paths (auth.ts's NextAuth config,
// session.ts's redirects, the Meta OAuth callback, sign-out) was updated
// to /auth/login and /auth/signup — there is no backward-compat redirect
// from the old paths, since neither is registered anywhere external
// (unlike the Meta OAuth callback URL, which can never move).
export default async function AuthPage({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;

  if (mode === "login") return <LoginForm />;
  if (mode === "signup") return <SignupForm />;
  notFound();
}
