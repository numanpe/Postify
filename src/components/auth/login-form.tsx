"use client";

import { useActionState } from "react";
import Link from "next/link";

import { login } from "@/lib/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
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
          className="rounded-md border border-neutral-300 px-3 py-2 text-base"
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
          className="rounded-md border border-neutral-300 px-3 py-2 text-base"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-base font-medium text-white disabled:opacity-60"
      >
        {pending ? "Logging in…" : "Log in"}
      </button>

      <p className="text-sm text-neutral-500">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-neutral-900 underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
