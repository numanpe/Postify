"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { generateVideo } from "@/lib/actions/video";
import { Button } from "@/components/ui/button";
import { TopicSuggestions, type TopicSuggestion } from "@/components/ui/topic-suggestions";
import { useDict } from "@/components/i18n/locale-provider";
import { NavIcons } from "@/components/icons";

interface MediaAssetOption {
  id: string;
  fileName: string;
  mimeType: string;
}

export function VideoForm({
  assets,
  narrationAvailable,
  defaultTopic,
  topicSuggestions,
  onSuccess,
}: {
  assets: MediaAssetOption[];
  narrationAvailable: boolean;
  // Carried over from the Step 1 wizard's chosen caption (studio/page.tsx).
  defaultTopic?: string;
  topicSuggestions: TopicSuggestion[];
  // Wizard Step 2 (wizard-step2.tsx) needs the new video's id to
  // advance to Step 3 — see poster-form.tsx's identical addition.
  onSuccess?: (videoId: string) => void;
}) {
  const [state, action, pending] = useActionState(generateVideo, undefined);
  const dict = useDict().video;
  const topicGuardDict = useDict().topicGuard;
  const router = useRouter();
  const [topic, setTopic] = useState(defaultTopic ?? "");
  const [template, setTemplate] = useState<"STANDARD" | "LOWER_THIRD_PROMO" | "WAVEFORM_CAPTIONS">("STANDARD");
  const templateHint =
    template === "LOWER_THIRD_PROMO"
      ? dict.motionTemplateLowerThirdHint
      : template === "WAVEFORM_CAPTIONS"
        ? dict.motionTemplateWaveformHint
        : dict.motionTemplateStandardHint;

  // See poster-form.tsx's identical effect — client-side refresh
  // instead of the server calling revalidatePath.
  useEffect(() => {
    if (state?.status === "success") {
      router.refresh();
      onSuccess?.(state.videoId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onSuccess is a fresh closure each render; only re-run when state/router actually change
  }, [state, router]);

  // Real, confirmed production gap (2026-08-25, via real `vercel logs`
  // output — "Vercel Runtime Timeout Error: Task timed out after 300
  // seconds" on a real narrated generation): a narrated video's real
  // caption-compositing cost (see render.ts's known filter-chain
  // bottleneck) can exceed the platform's hard function ceiling with
  // NO error ever reaching generateVideo's own try/catch — the process
  // is killed at the infrastructure level before any of this app's
  // code runs again, so there is no server-side response to catch,
  // ever. This can only be handled client-side, by elapsed time alone:
  // a reassurance notice as narrated generation runs long (real,
  // expected, not necessarily failing yet), a stronger warning as it
  // approaches the real 300s ceiling, and an honest fallback message if
  // the request ends with neither a success nor an error state at all
  // (the platform killed it, or the connection dropped — "Error: The
  // destination stream closed early." was also observed for real in
  // the same log window) — never a silently re-enabled button with no
  // explanation.
  const [longWaitLevel, setLongWaitLevel] = useState<"none" | "slow" | "verySlow">("none");
  const [silentFailure, setSilentFailure] = useState(false);
  const stateAtSubmitRef = useRef(state);
  // Distinguishes "a submission genuinely ran and ended with no state
  // change" from ordinary initial mount, where state/stateAtSubmitRef
  // are trivially reference-equal (both undefined) without any real
  // submission having happened at all.
  const hasSubmittedRef = useRef(false);

  useEffect(() => {
    // Real, deliberate: every setState call below runs inside a
    // setTimeout (even the 0ms one) rather than synchronously in the
    // effect body — react-hooks/set-state-in-effect correctly flags
    // direct synchronous setState here as a cascading-render risk; a
    // 0ms timer defers it to its own real task, same fix pattern this
    // codebase already uses elsewhere (voice-input-button.tsx).
    if (!pending) {
      const reset = window.setTimeout(() => setLongWaitLevel("none"), 0);
      return () => window.clearTimeout(reset);
    }
    hasSubmittedRef.current = true;
    stateAtSubmitRef.current = state;
    const clearFailure = window.setTimeout(() => setSilentFailure(false), 0);
    const slowTimer = window.setTimeout(() => setLongWaitLevel("slow"), 45_000);
    // 100s of real buffer before Vercel's real 300s hard limit —
    // enough time left for this warning to actually be useful, not
    // just a postmortem shown after the kill already happened.
    const verySlowTimer = window.setTimeout(() => setLongWaitLevel("verySlow"), 200_000);
    return () => {
      window.clearTimeout(clearFailure);
      window.clearTimeout(slowTimer);
      window.clearTimeout(verySlowTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only re-arms when `pending` itself changes, not on every `state` identity change
  }, [pending]);

  useEffect(() => {
    if (pending || !hasSubmittedRef.current) return;
    hasSubmittedRef.current = false;
    // A real completed action (success or error) always returns a NEW
    // state object — reference equality to what was captured right
    // before this submission is the real, reliable signal that nothing
    // ever came back at all, distinct from a normal server-reported error.
    if (state === stateAtSubmitRef.current) {
      const failTimer = window.setTimeout(() => setSilentFailure(true), 0);
      return () => window.clearTimeout(failTimer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately only reacts to pending flipping false
  }, [pending]);

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="topic" className="text-sm font-medium">
          {dict.topic}
        </label>
        <input
          id="topic"
          name="topic"
          required
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={dict.topicPlaceholder}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
        <TopicSuggestions suggestions={topicSuggestions} currentValue={topic} onSelect={setTopic} label={topicGuardDict.suggestionsLabel} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="aspectRatio" className="text-sm font-medium">
          {dict.format}
        </label>
        <select
          id="aspectRatio"
          name="aspectRatio"
          defaultValue="STORY"
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        >
          <option value="SQUARE">{dict.formatSquare}</option>
          <option value="STORY">{dict.formatStory}</option>
          <option value="LANDSCAPE">{dict.formatLandscape}</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="useNarration" defaultChecked={narrationAvailable} disabled={!narrationAvailable} />
        {dict.narration}
        {!narrationAvailable && <span className="text-ink-soft dark:text-ink-soft-dark">{dict.narrationHint}</span>}
      </label>

      <div className="flex flex-col gap-1">
        <label htmlFor="template" className="text-sm font-medium">
          {dict.motionTemplate}
        </label>
        <select
          id="template"
          name="template"
          value={template}
          onChange={(e) => setTemplate(e.target.value as typeof template)}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        >
          <option value="STANDARD">{dict.motionTemplateStandard}</option>
          <option value="LOWER_THIRD_PROMO">{dict.motionTemplateLowerThird}</option>
          <option value="WAVEFORM_CAPTIONS">{dict.motionTemplateWaveform}</option>
        </select>
        <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{templateHint}</p>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">
          {dict.footage} <span className="font-normal text-ink-soft dark:text-ink-soft-dark">{dict.footageHint}</span>
        </span>
        {assets.length === 0 ? (
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.noFootage}</p>
        ) : (
          <ul className="flex flex-col gap-1 rounded-md border border-paper-border dark:border-night-border p-2">
            {assets.map((asset) => (
              <li key={asset.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="assetIds" value={asset.id} />
                  <span className="truncate">{asset.fileName}</span>
                  <span className="text-xs text-ink-soft dark:text-ink-soft-dark">
                    {asset.mimeType.startsWith("video/") ? dict.kindVideo : dict.kindPhoto}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pending && longWaitLevel === "slow" && (
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.generatingSlowNotice}</p>
      )}
      {pending && longWaitLevel === "verySlow" && (
        <p className="text-sm text-amber-600 dark:text-amber-400">{dict.generatingVerySlowWarning}</p>
      )}
      {silentFailure && <p className="text-sm text-red-600 dark:text-red-400">{dict.generatingSilentFailure}</p>}
      {state?.status === "error" && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state?.status === "success" && (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-green-700 dark:text-green-400">{dict.generatedSuccess}</p>
          {state.usedTopic && (
            <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{topicGuardDict.clarifiedNotice(state.usedTopic)}</p>
          )}
          {state.warnings.map((warning) => (
            <p key={warning} className="text-sm text-amber-600 dark:text-amber-400">
              {warning}
            </p>
          ))}
        </div>
      )}

      <Button type="submit" pending={pending} pendingLabel={dict.generating}>
        <NavIcons.video size={18} aria-hidden="true" />
        {dict.generate}
      </Button>
    </form>
  );
}
