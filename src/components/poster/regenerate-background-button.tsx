"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { regeneratePosterBackground } from "@/lib/actions/poster";
import { useDict } from "@/components/i18n/locale-provider";

// The real, scoped mitigation for the Cloudflare "Free AI" pool's known
// text-hallucination rate (~a third of AI backgrounds, per real testing
// this session — see project memory) — a fast, obvious manual retry for
// when a human notices a bad result, deliberately not an automated
// detection/regeneration system (OCR-based auto-detection was
// investigated and rejected as unreliable). Only rendered for
// backgroundSource === "AI" posters by the caller.
export function RegenerateBackgroundButton({ posterId }: { posterId: string }) {
  const dict = useDict().poster;
  const [state, action, pending] = useActionState(regeneratePosterBackground, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.status === "success") {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="posterId" value={posterId} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-[36px] rounded-md border border-paper-border px-2 text-xs font-medium text-ink hover:bg-paper-card disabled:cursor-not-allowed disabled:opacity-60 dark:border-night-border dark:text-ink-dark dark:hover:bg-night-card"
      >
        {pending ? dict.regeneratingBackground : dict.regenerateBackground}
      </button>
      {state?.status === "error" && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state?.status === "success" && (
        <p role="status" className="text-xs text-green-700 dark:text-green-400">
          {dict.regenerateBackgroundSuccess}
        </p>
      )}
    </form>
  );
}
