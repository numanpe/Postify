"use client";

import { useActionState } from "react";

import { saveProviderCredential } from "@/lib/actions/provider-credentials";

export function ProviderCredentialForm() {
  const [state, action, pending] = useActionState(saveProviderCredential, undefined);

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="provider" className="text-sm font-medium">
          Provider
        </label>
        <select
          id="provider"
          name="provider"
          required
          defaultValue="OPENAI"
          className="rounded-md border border-neutral-300 px-3 py-2 text-base"
        >
          <option value="OPENAI">OpenAI</option>
          <option value="ANTHROPIC">Anthropic</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="apiKey" className="text-sm font-medium">
          API key
        </label>
        <input
          id="apiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          required
          className="rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-base font-medium text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save key"}
      </button>
    </form>
  );
}
