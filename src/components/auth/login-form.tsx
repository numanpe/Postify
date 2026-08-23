"use client";

import { useActionState } from "react";
import Link from "next/link";

import { login, signInWithGoogle } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/google-icon";

// Set by requireUser()/requireCompany() (src/lib/session.ts) redirecting
// here after finding an already-signed-in session belongs to a
// banned/suspended account/company, and by login()'s own pre-check for
// the credentials path — same wording either way. Read server-side by
// the page (src/app/(auth)/auth/[mode]/page.tsx via its searchParams
// prop) and passed down, rather than useSearchParams() here, so this
// page doesn't need a Suspense boundary to stay statically renderable.
const STATUS_MESSAGES: Record<string, string> = {
  banned: "This account has been banned.",
  suspended: "This account is suspended.",
  company_banned: "Your company account has been banned.",
  company_suspended: "Your company account is suspended.",
};

export function LoginForm({ googleConfigured, status }: { googleConfigured: boolean; status?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  const statusMessage = STATUS_MESSAGES[status ?? ""];

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      {statusMessage && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {statusMessage}
        </p>
      )}
      {googleConfigured && (
        <>
          <form action={signInWithGoogle}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-paper-border bg-paper px-4 py-2 text-base font-medium text-ink hover:bg-paper-card dark:border-night-border dark:bg-night-card dark:text-ink-dark dark:hover:bg-night"
            >
              <GoogleIcon size={18} aria-hidden="true" />
              Continue with Google
            </button>
          </form>
          <div className="flex items-center gap-3 text-xs text-ink-soft dark:text-ink-soft-dark">
            <span className="h-px flex-1 bg-paper-border dark:bg-night-border" />
            or
            <span className="h-px flex-1 bg-paper-border dark:bg-night-border" />
          </div>
        </>
      )}

      <form action={action} className="flex w-full flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
          />
        </div>

        {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

        <Button type="submit" pending={pending} pendingLabel="Logging in…">
          Log in
        </Button>

        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">
          <Link href="/auth/forgot-password" className="font-medium text-ink dark:text-ink-dark underline">
            Forgot password?
          </Link>
        </p>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="font-medium text-ink dark:text-ink-dark underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
