"use client";

import { useActionState } from "react";

import { uploadMedia } from "@/lib/actions/media";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";

export function UploadMediaForm() {
  const [state, action, pending] = useActionState(uploadMedia, undefined);
  const dict = useDict().media;

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
