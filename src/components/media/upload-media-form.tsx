"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { uploadMedia } from "@/lib/actions/media";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";

export function UploadMediaForm() {
  const [state, action, pending] = useActionState(uploadMedia, undefined);
  const dict = useDict().media;
  const router = useRouter();

  // uploadMedia's state has no "success" flag (undefined covers both
  // "hasn't submitted yet" and "just succeeded"), so this watches for
  // the pending -> not-pending transition instead — same client-side
  // refresh pattern as poster/video, replacing a server revalidatePath.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, state, router]);

  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        type="file"
        name="files"
        multiple
        required
        accept="image/*,video/*,audio/*"
        className="text-sm"
      />
      <Button type="submit" pending={pending} pendingLabel={dict.uploading} size="sm" className="w-fit">
        {dict.upload}
      </Button>
      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : (
        <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.uploadHint}</p>
      )}
    </form>
  );
}
