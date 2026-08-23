"use client";

import { useActionState } from "react";

import { saveProviderCredential } from "@/lib/actions/provider-credentials";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";

export function ProviderCredentialForm() {
  const [state, action, pending] = useActionState(saveProviderCredential, undefined);
  const dict = useDict().settings;

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="provider" className="text-sm font-medium">
          {dict.provider}
        </label>
        <select
          id="provider"
          name="provider"
          required
          defaultValue="OPENAI"
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        >
          <option value="OPENAI">OpenAI</option>
          <option value="ANTHROPIC">Anthropic</option>
          <option value="ELEVENLABS">ElevenLabs</option>
          <option value="FISH_AUDIO">Fish Audio</option>
          <option value="GEMINI">Google Gemini</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="apiKey" className="text-sm font-medium">
          {dict.apiKey}
        </label>
        <input
          id="apiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          required
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 font-mono text-base"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

      <Button type="submit" pending={pending} pendingLabel={dict.saving}>
        {dict.saveKey}
      </Button>
    </form>
  );
}
