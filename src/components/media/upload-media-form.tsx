"use client";

import { useActionState } from "react";

import { uploadMedia } from "@/lib/actions/media";
import { Button } from "@/components/ui/button";

export function UploadMediaForm() {
  const [state, action, pending] = useActionState(uploadMedia, undefined);

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
      <Button type="submit" pending={pending} pendingLabel="Uploading…" size="sm" className="w-fit">
        Upload
      </Button>
      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
