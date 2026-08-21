"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";

import { generateWizardStep1 } from "@/lib/actions/studio-wizard";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";

export function WizardStep1Form({
  companyName,
  defaultTopic,
}: {
  companyName: string;
  // Part B3.2: pre-filled from a real onboarding extraction when the
  // user just arrived from website-first company creation — absent
  // (and the field stays blank) for every other visit to this page,
  // including the manual-signup path, which has no extracted
  // description to derive a suggestion from.
  defaultTopic?: string;
}) {
  const [state, action, pending] = useActionState(generateWizardStep1, undefined);
  const [chosenIndex, setChosenIndex] = useState(0);
  const dict = useDict().wizard;
  const router = useRouter();

  return (
    <div className="flex w-full max-w-lg flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.step1Title}</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.step1Subtitle(companyName)}</p>
      </div>

      <form action={action} className="flex flex-col gap-2">
        <label htmlFor="topic" className="text-sm font-medium">
          {dict.topicLabel}
        </label>
        <input
          id="topic"
          name="topic"
          defaultValue={defaultTopic}
          placeholder={dict.topicPlaceholder}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" pending={pending} pendingLabel={dict.generating}>
            {dict.generate}
          </Button>
          {/* Two submit buttons, same form/action — the clicked button's
              own name/value pair (or its absence) is what the server
              action reads via formData.get("autoGenerate"), standard
              HTML behavior, no extra client JS needed to distinguish them. */}
          <button
            type="submit"
            name="autoGenerate"
            value="true"
            disabled={pending}
            className="rounded-lg border border-paper-border px-4 py-2 text-base font-medium text-ink hover:bg-paper-card disabled:cursor-not-allowed disabled:opacity-60 dark:border-night-border dark:text-ink-dark dark:hover:bg-night-card"
          >
            {dict.autoGenerate}
          </button>
        </div>
      </form>

      {state?.status === "error" && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

      {state?.status === "success" && (
        <div className="flex flex-col gap-4 rounded-md border border-paper-border p-4 dark:border-night-border">
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
