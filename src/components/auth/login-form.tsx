"use client";

import { useActionState } from "react";
import Link from "next/link";

import { login, signInWithGoogle } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/google-icon";

export function LoginForm({ googleConfigured }: { googleConfigured: boolean }) {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
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
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="font-medium text-ink dark:text-ink-dark underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
