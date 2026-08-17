"use client";

import { useActionState } from "react";

import { updateVoiceEngine } from "@/lib/actions/voice-engine";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";

async function action(_prevState: { saved: boolean }, formData: FormData) {
  await updateVoiceEngine(formData);
  return { saved: true };
}

export function VoiceEngineToggle({ currentEngine }: { currentEngine: "FREE" | "BYOK" }) {
  const [state, formAction, pending] = useActionState(action, { saved: false });
  const dict = useDict().settings;

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">{dict.voiceEngineTitle}</h2>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.voiceEngineSubtitle}</p>
      </div>

      <label className="flex items-start gap-2 rounded-md border border-paper-border dark:border-night-border p-3 text-sm has-[:checked]:border-ink has-[:checked]:dark:border-ink-dark">
        <input type="radio" name="voiceEngine" value="FREE" defaultChecked={currentEngine === "FREE"} className="mt-1 accent-current" />
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">{dict.voiceEngineFree}</span>
          <span className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.voiceEngineFreeDescription}</span>
        </span>
      </label>

      <label className="flex items-start gap-2 rounded-md border border-paper-border dark:border-night-border p-3 text-sm has-[:checked]:border-ink has-[:checked]:dark:border-ink-dark">
        <input type="radio" name="voiceEngine" value="BYOK" defaultChecked={currentEngine === "BYOK"} className="mt-1 accent-current" />
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">{dict.voiceEngineByok}</span>
          <span className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.voiceEngineByokDescription}</span>
        </span>
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" pending={pending}>
          {dict.voiceEngineSave}
        </Button>
        {state.saved && !pending && (
          <span className="text-sm text-green-700 dark:text-green-400">{dict.voiceEngineSaved}</span>
        )}
      </div>
    </form>
  );
}
