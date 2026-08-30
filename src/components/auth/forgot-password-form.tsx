"use client";

import { useActionState } from "react";
import Link from "next/link";

import { requestPasswordReset } from "@/lib/actions/password-reset";
import { Button } from "@/components/ui/button";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  if (state?.status === "sent") {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <p role="status" className="text-sm">
          If an account exists for that email, we&apos;ve sent a link to reset your password. It expires in 1 hour.
        </p>
        <Link href="/auth/login" className="text-sm font-medium text-ink dark:text-ink-dark underline">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <p className="text-sm text-ink-soft dark:text-ink-soft-dark">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>
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

        {state?.status === "error" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}

        <Button type="submit" pending={pending} pendingLabel="Sending…">
          Send reset link
        </Button>

        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">
          <Link href="/auth/login" className="font-medium text-ink dark:text-ink-dark underline">
            Back to log in
          </Link>
        </p>
      </form>
    </div>
  );
}
