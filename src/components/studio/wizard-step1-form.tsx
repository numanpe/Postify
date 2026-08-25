"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { generateWizardStep1 } from "@/lib/actions/studio-wizard";
import { Button } from "@/components/ui/button";
import { VoiceInputButton } from "@/components/ui/voice-input-button";
import { TopicSuggestions, type TopicSuggestion } from "@/components/ui/topic-suggestions";
import { useDict, useLocale } from "@/components/i18n/locale-provider";
import { parseDurationRequest } from "@/lib/campaign-duration";

export function WizardStep1Form({
  companyName,
  defaultTopic,
  topicSuggestions,
}: {
  companyName: string;
  // Part B3.2: pre-filled from a real onboarding extraction when the
  // user just arrived from website-first company creation — absent
  // (and the field stays blank) for every other visit to this page,
  // including the manual-signup path, which has no extracted
  // description to derive a suggestion from.
  defaultTopic?: string;
  topicSuggestions: TopicSuggestion[];
}) {
  const [state, action, pending] = useActionState(generateWizardStep1, undefined);
  const [chosenIndex, setChosenIndex] = useState(0);
  const [topic, setTopic] = useState(defaultTopic ?? "");
  // Real fix, not cosmetic: the free tier's caption picker is fully
  // deterministic given identical inputs (see studio-wizard.ts), so
  // re-submitting the same topic (or clicking Auto-Generate again the
  // same day, which is deliberately the same topic by design) needs a
  // different attempt number to actually vary the 3 captions shown —
  // otherwise repeat clicks silently returned the same 3 every time.
  // Tracked by which submit control was used (manual topic text vs.
  // Auto-Generate's day-locked topic), since those are two genuinely
  // different "same input" cases. Plain refs + a direct DOM write in
  // onSubmit, not state — state would only reach the hidden input one
  // submission too late for a native (non-preventDefault'd) form submit.
  const attemptRef = useRef(0);
  const lastSubmissionKeyRef = useRef<string | null>(null);
  const attemptInputRef = useRef<HTMLInputElement>(null);
  const [durationDismissed, setDurationDismissed] = useState(false);
  const dict = useDict().wizard;
  const voiceDict = useDict().voiceInput;
  const topicGuardDict = useDict().topicGuard;
  const locale = useLocale();
  const router = useRouter();

  const duration = parseDurationRequest(topic);

  return (
    <div className="flex w-full max-w-lg flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.step1Title}</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.step1Subtitle(companyName)}</p>
      </div>

      <form
        action={action}
        onSubmit={(e) => {
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          // "Show me another idea" is genuinely randomized server-side
          // every call (see studio-wizard.ts) so it never needs an
          // attempt bump to vary — a fresh key each time (Date.now())
          // just keeps it from accidentally colliding with a real
          // repeated key and skipping its own reset.
          const key =
            submitter?.name === "autoGenerate"
              ? "AUTO_GENERATE"
              : submitter?.name === "showAnotherIdea"
                ? `ANOTHER:${Date.now()}`
                : topic;
          attemptRef.current = lastSubmissionKeyRef.current === key ? attemptRef.current + 1 : 0;
          lastSubmissionKeyRef.current = key;
          if (attemptInputRef.current) attemptInputRef.current.value = String(attemptRef.current);
        }}
        className="flex flex-col gap-2"
      >
        <input ref={attemptInputRef} type="hidden" name="attempt" defaultValue={0} />
        <label htmlFor="topic" className="text-sm font-medium">
          {dict.topicLabel}
        </label>
        <div className="flex items-start gap-2">
          <input
            id="topic"
            name="topic"
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              setDurationDismissed(false);
            }}
            placeholder={dict.topicPlaceholder}
            className="flex-1 rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
          />
          <VoiceInputButton
            lang={locale === "ar" ? "ar-SA" : "en-US"}
            onResult={(text) => {
              setTopic(text);
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

        <TopicSuggestions suggestions={topicSuggestions} currentValue={topic} onSelect={setTopic} label={topicGuardDict.suggestionsLabel} />

        {duration && !durationDismissed && (
          <div className="flex flex-col gap-2 rounded-md border border-paper-border bg-paper-card p-3 text-sm dark:border-night-border dark:bg-night-card">
            <p>{duration.wasCapped ? dict.durationSuggestionCapped(duration.requestedDays, duration.days) : dict.durationSuggestion(duration.days)}</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/campaigns?objective=${encodeURIComponent(duration.cleanedObjective)}&days=${duration.days}`}
                className="text-sm font-medium text-primary underline dark:text-primary-dark"
              >
                {dict.durationSuggestionAction}
              </Link>
              <button
                type="button"
                onClick={() => setDurationDismissed(true)}
                className="text-sm text-ink-soft underline dark:text-ink-soft-dark"
              >
                {dict.durationSuggestionDismiss}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" pending={pending} pendingLabel={dict.generating}>
            {dict.generate}
          </Button>
          {/* Three submit buttons, same form/action — the clicked button's
              own name/value pair (or its absence) is what the server
              action reads via formData.get("autoGenerate")/("showAnotherIdea"),
              standard HTML behavior, no extra client JS needed to
              distinguish them. */}
          <button
            type="submit"
            name="autoGenerate"
            value="true"
            disabled={pending}
            className="rounded-lg border border-paper-border px-4 py-2 text-base font-medium text-ink hover:bg-paper-card disabled:cursor-not-allowed disabled:opacity-60 dark:border-night-border dark:text-ink-dark dark:hover:bg-night-card"
          >
            {dict.autoGenerate}
          </button>
          {/* Real, distinct escape hatch (2026-08-25): Auto-Generate
              deliberately shows the same idea all day (see
              studio-wizard.ts) — this is the genuinely-random on-demand
              alternative, not a rename of the same button. */}
          <button
            type="submit"
            name="showAnotherIdea"
            value="true"
            disabled={pending}
            className="rounded-lg border border-paper-border px-4 py-2 text-base font-medium text-ink hover:bg-paper-card disabled:cursor-not-allowed disabled:opacity-60 dark:border-night-border dark:text-ink-dark dark:hover:bg-night-card"
          >
            {dict.showAnotherIdea}
          </button>
        </div>
        <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.autoGenerateHint}</p>
      </form>

      {state?.status === "error" && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

      {state?.status === "success" && (
        <div className="flex flex-col gap-4 rounded-md border border-paper-border p-4 dark:border-night-border">
          {state.wasClarified && (
            <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{topicGuardDict.clarifiedNotice(state.topic)}</p>
          )}
          <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.chooseHint}</p>
          <div role="radiogroup" className="flex flex-col gap-2">
            {state.captions.map((caption, i) => (
              <label
                key={i}
                className={`flex min-h-[48px] cursor-pointer items-start gap-2 rounded-md border p-3 text-sm ${
                  chosenIndex === i
                    ? "border-primary bg-primary/5 dark:border-primary-dark"
                    : "border-paper-border dark:border-night-border"
                }`}
              >
                <input
                  type="radio"
                  name="chosenCaption"
                  checked={chosenIndex === i}
                  onChange={() => setChosenIndex(i)}
                  className="mt-1 accent-current"
                />
                <span>{caption}</span>
              </label>
            ))}
          </div>

          {state.hashtags.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">{dict.hashtagsLabel}</span>
              <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{state.hashtags.join(" ")}</p>
            </div>
          )}

          <Button
            type="button"
            onClick={() => {
              const params = new URLSearchParams({
                topic: state.topic,
                caption: state.captions[chosenIndex],
              });
              router.push(`/studio/design?${params.toString()}`);
            }}
          >
            {dict.nextCreateAsset}
          </Button>
        </div>
      )}
    </div>
  );
}
