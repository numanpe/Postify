"use client";

import { useActionState, useState } from "react";
import type { SocialPlatform } from "@prisma/client";

import { saveRecurringPlan } from "@/lib/actions/recurring-plan";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";

interface ExistingPlan {
  postsPerDay: number;
  videosPerDay: number;
  publishTimes: string[];
  targetPlatforms: SocialPlatform[];
  objectiveHint: string | null;
  autoPublish: boolean;
}

export function RecurringPlanForm({
  existing,
  connectedPlatforms,
  canAutoPublish,
}: {
  existing: ExistingPlan | null;
  connectedPlatforms: { platform: SocialPlatform; label: string }[];
  canAutoPublish: boolean;
}) {
  const dict = useDict().recurringPlan;
  const [state, action, pending] = useActionState(saveRecurringPlan, undefined);
  const [autoPublish, setAutoPublish] = useState(existing?.autoPublish ?? false);

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-4">
      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="postsPerDay" className="text-sm font-medium">
            {dict.postsPerDay}
          </label>
          <input
            id="postsPerDay"
            name="postsPerDay"
            type="number"
            min={0}
            max={10}
            defaultValue={existing?.postsPerDay ?? 1}
            required
            className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="videosPerDay" className="text-sm font-medium">
            {dict.videosPerDay}
          </label>
          <input
            id="videosPerDay"
            name="videosPerDay"
            type="number"
            min={0}
            max={10}
            defaultValue={existing?.videosPerDay ?? 0}
            required
            className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="publishTimes" className="text-sm font-medium">
          {dict.publishTimes} <span className="font-normal text-ink-soft dark:text-ink-soft-dark">({dict.publishTimesHint})</span>
        </label>
        <input
          id="publishTimes"
          name="publishTimes"
          defaultValue={existing?.publishTimes.join(", ") ?? ""}
          placeholder={dict.publishTimesPlaceholder}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
        <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.cronPrecisionNote}</p>
      </div>

      {connectedPlatforms.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">{dict.targetPlatformsLabel}</span>
          <div className="flex flex-wrap gap-3">
            {connectedPlatforms.map((p) => (
              <label key={p.platform} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="targetPlatforms"
                  value={p.platform}
                  defaultChecked={existing?.targetPlatforms.includes(p.platform) ?? true}
                  className="accent-current"
                />
                {p.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="objectiveHint" className="text-sm font-medium">
          {dict.objectiveHint}
        </label>
        <input
          id="objectiveHint"
          name="objectiveHint"
          defaultValue={existing?.objectiveHint ?? ""}
          placeholder={dict.objectiveHintPlaceholder}
          maxLength={200}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="autoPublish"
            value="true"
            checked={autoPublish}
            disabled={!canAutoPublish}
            onChange={(e) => setAutoPublish(e.target.checked)}
            className="accent-current disabled:cursor-not-allowed"
          />
          {dict.autoPublish}
        </label>
        {!canAutoPublish && <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.autoPublishDisabledHint}</p>}
        {canAutoPublish && autoPublish && (
          <p className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300">
            {dict.autoPublishWarning}
          </p>
        )}
      </div>

      {state && "error" in state && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state && "success" in state && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {dict.saved}
        </p>
      )}

      <Button type="submit" pending={pending} pendingLabel={dict.saving}>
        {dict.save}
      </Button>
    </form>
  );
}
