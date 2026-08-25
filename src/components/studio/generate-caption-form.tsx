"use client";

import { useActionState, useRef, useState } from "react";

import { generateCaption } from "@/lib/actions/content";
import { Button } from "@/components/ui/button";
import { TopicSuggestions, type TopicSuggestion } from "@/components/ui/topic-suggestions";
import { useDict } from "@/components/i18n/locale-provider";
import { NavIcons } from "@/components/icons";

export function GenerateCaptionForm({ topicSuggestions }: { topicSuggestions: TopicSuggestion[] }) {
  const [state, action, pending] = useActionState(generateCaption, undefined);
  const dict = useDict().studio;
  const topicGuardDict = useDict().topicGuard;
  const [topic, setTopic] = useState("");
  // Real fix, not cosmetic: the free tier's caption picker is fully
  // deterministic given identical (topic, attempt) inputs (see
  // content.ts), so re-submitting the exact same topic needs a
  // different attempt number to actually get a different result —
  // otherwise "click Generate again" silently returns the same text.
  // Resets to 0 whenever the topic itself changes, since that's already
  // a genuinely different input with no repetition risk. Plain refs
  // (not state) and a direct DOM write in onSubmit — a setState here
  // would only reach the hidden input on the NEXT render, one
  // submission too late for a native (non-preventDefault'd) form
  // submit, which serializes FormData from the current DOM immediately
  // after synchronous submit handlers finish.
  const attemptRef = useRef(0);
  const lastSubmittedTopicRef = useRef<string | null>(null);
  const attemptInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex w-full max-w-lg flex-col gap-4">
      <form
        action={action}
        onSubmit={() => {
          attemptRef.current = lastSubmittedTopicRef.current === topic ? attemptRef.current + 1 : 0;
          lastSubmittedTopicRef.current = topic;
          if (attemptInputRef.current) attemptInputRef.current.value = String(attemptRef.current);
        }}
        className="flex flex-col gap-2"
      >
        <input ref={attemptInputRef} type="hidden" name="attempt" defaultValue={0} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            name="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={dict.topicPlaceholder}
            required
            className="flex-1 rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
          />
          <Button type="submit" pending={pending} pendingLabel={dict.generating} size="sm">
            <NavIcons.studio size={16} aria-hidden="true" />
            {dict.generate}
          </Button>
        </div>
        <TopicSuggestions suggestions={topicSuggestions} currentValue={topic} onSelect={setTopic} label={topicGuardDict.suggestionsLabel} />
      </form>

      {state?.status === "error" && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state?.status === "success" && state.usedTopic && (
        <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{topicGuardDict.clarifiedNotice(state.usedTopic)}</p>
      )}

      {state?.status === "success" && (
        <div className="flex flex-col gap-2 rounded-md border border-paper-border dark:border-night-border p-4">
          <p className="text-base">{state.text}</p>
          <p className="text-xs text-ink-soft dark:text-ink-soft-dark">
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
