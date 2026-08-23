"use client";

import { useActionState } from "react";
import Link from "next/link";

import { resetPassword } from "@/lib/actions/password-reset";
import { Button } from "@/components/ui/button";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);

  if (state?.status === "success") {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <p className="text-sm">Your password has been reset.</p>
        <Link href="/auth/login" className="text-sm font-medium text-ink dark:text-ink-dark underline">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
      </div>

      {state?.status === "error" && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

      <Button type="submit" pending={pending} pendingLabel="Resetting…">
        Reset password
      </Button>
    </form>
  );
}
