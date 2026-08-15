"use client";

import { useActionState } from "react";

import { uploadMedia } from "@/lib/actions/media";

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
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Upload"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
