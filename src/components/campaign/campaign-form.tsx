"use client";

import { useActionState, useState } from "react";

import { createCampaign } from "@/lib/actions/campaign";
import { Button } from "@/components/ui/button";
import { VoiceInputButton } from "@/components/ui/voice-input-button";
import { TopicSuggestions, type TopicSuggestion } from "@/components/ui/topic-suggestions";
import { useDict, useLocale } from "@/components/i18n/locale-provider";
import { parseDurationRequest, MAX_CAMPAIGN_DAYS } from "@/lib/campaign-duration";

export function CampaignForm({
  defaultObjective,
  defaultDays,
  topicSuggestions,
}: {
  // Prefilled when arriving from another entry point (e.g. the Studio
  // wizard's "this sounds like N days of content" suggestion) that
  // detected a real timeframe in what the user typed or spoke — this
  // form is still the one place that actually commits to generating
  // anything, same real approval-before-generation step as always.
  defaultObjective?: string;
  defaultDays?: number;
  topicSuggestions: TopicSuggestion[];
}) {
  const [state, action, pending] = useActionState(createCampaign, undefined);
  const today = new Date().toISOString().slice(0, 10);
  const dict = useDict().campaigns;
  const voiceDict = useDict().voiceInput;
  const topicGuardDict = useDict().topicGuard;
  const locale = useLocale();

  const [objective, setObjective] = useState(defaultObjective ?? "");
  const [days, setDays] = useState(defaultDays ?? 7);
  const [durationDismissed, setDurationDismissed] = useState(false);
  // Off by default (see Campaign.useAiBackgrounds's own schema comment
  // for why) — a company consciously opts in per campaign rather than
  // this silently defaulting on.
  const [useAiBackgrounds, setUseAiBackgrounds] = useState(false);

  const duration = parseDurationRequest(objective);
  const showDurationSuggestion = duration && !durationDismissed && duration.days !== days;

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="objective" className="text-sm font-medium">
          {dict.objective}
        </label>
        <div className="flex items-start gap-2">
          <input
            id="objective"
            name="objective"
            required
            value={objective}
            onChange={(e) => {
              setObjective(e.target.value);
              setDurationDismissed(false);
            }}
            placeholder={dict.objectivePlaceholder}
            className="flex-1 rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
          />
          <VoiceInputButton
            lang={locale === "ar" ? "ar-SA" : "en-US"}
            onResult={(text) => {
              setObjective(text);
              setDurationDismissed(false);
            }}
            startLabel={voiceDict.startLabel}
            listeningLabel={voiceDict.listeningLabel}
            errorMessages={{
              notAllowed: voiceDict.errorNotAllowed,
              noSpeech: voiceDict.errorNoSpeech,
              network: voiceDict.errorNetwork,
              generic: voiceDict.errorGeneric,
            }}
          />
        </div>

        <TopicSuggestions suggestions={topicSuggestions} currentValue={objective} onSelect={setObjective} label={topicGuardDict.suggestionsLabel} />

        {showDurationSuggestion && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-paper-border bg-paper-card p-2 text-xs dark:border-night-border dark:bg-night-card">
            <span>
              {duration.wasCapped
                ? dict.durationDetectedCapped(duration.requestedDays, duration.days)
                : dict.durationDetected(duration.days)}
            </span>
            <button
              type="button"
              onClick={() => {
                setDays(duration.days);
                // Also clean up the objective text itself — a real bug
                // found during this feature's own verification: the
                // raw duration phrasing ("give me 2 weeks of...") was
                // otherwise landing straight in generated marketing
                // copy. An explicit click, not a silent background
                // edit — and still a normal editable field afterward.
                setObjective(duration.cleanedObjective);
                setDurationDismissed(true);
              }}
              className="font-medium text-primary underline dark:text-primary-dark"
            >
              {dict.durationApply}
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="startDate" className="text-sm font-medium">
            {dict.startDate}
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={today}
            required
            className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
          />
        </div>
        <div className="flex w-28 flex-col gap-1">
          <label htmlFor="days" className="text-sm font-medium">
            {dict.days}
          </label>
          <input
            id="days"
            name="days"
            type="number"
            min={1}
            max={MAX_CAMPAIGN_DAYS}
            value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(MAX_CAMPAIGN_DAYS, Number(e.target.value) || 1)))}
            required
            className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="useAiBackgrounds"
            value="true"
            checked={useAiBackgrounds}
            onChange={(e) => setUseAiBackgrounds(e.target.checked)}
            className="accent-current"
          />
          {dict.useAiBackgrounds}
        </label>
        <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.useAiBackgroundsDisclosure}</p>
      </div>

      {/* Real preview before committing — matches this app's existing
          approval-before-generation pattern elsewhere (e.g. campaign
          item approval). Computed from the exact same rule the actual
          generator uses (template-provider.ts's generateCampaignBrief:
          first item is a video only when there's more than one item),
          not a separate guess. */}
      <p className="text-sm text-ink-soft dark:text-ink-soft-dark">
        {days > 1 ? dict.previewMulti(days) : dict.previewSingle}
      </p>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <Button type="submit" pending={pending} pendingLabel={dict.submitPending}>
        {dict.submit}
      </Button>
    </form>
  );
}
