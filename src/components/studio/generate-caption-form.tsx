"use client";

import { useActionState } from "react";

import { generateCaption } from "@/lib/actions/content";

export function GenerateCaptionForm() {
  const [state, action, pending] = useActionState(generateCaption, undefined);

  return (
    <div className="flex w-full max-w-lg flex-col gap-4">
      <form action={action} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          name="topic"
          placeholder="What's this post about? e.g. our new spring menu"
          required
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-base"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Generating…" : "Generate"}
        </button>
      </form>

      {state?.status === "error" && <p className="text-sm text-red-600">{state.error}</p>}

      {state?.status === "success" && (
        <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-4">
          <p className="text-base">{state.text}</p>
          <p className="text-xs text-neutral-500">
            {state.providerName}
            {state.model ? ` · ${state.model}` : ""}
            {typeof state.estimatedCostUsd === "number"
              ? ` · ~$${state.estimatedCostUsd.toFixed(4)}`
              : ""}
          </p>
        </div>
      )}
    </div>
  );
}
