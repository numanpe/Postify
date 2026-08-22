"use client";

import { useState, useTransition } from "react";

import { lockCreativeDnaTopic, unlockCreativeDnaTopic, resetCreativeDnaLearning } from "@/lib/actions/creative-dna";

export type Dimension = "topics" | "templates" | "tones" | "visualStyles";

// sentence is pre-rendered server-side (see settings/page.tsx) — it's
// the output of dict.settings.preferencesPositive/Negative, both of
// which are functions. Real production bug found here: this component
// used to receive Dictionary["settings"] directly as a prop from the
// server SettingsPage and call those functions client-side. Next.js's
// RSC boundary cannot serialize functions across server -> client
// props ("Functions cannot be passed directly to Client Components"),
// so every load of /settings threw. Passing the already-computed
// string instead keeps the "natural per-locale sentence structure"
// intent (dictionaries.ts's documented reason these are functions, not
// templates) while never sending a function over the boundary.
export interface PreferenceRow {
  dimension: Dimension;
  value: string;
  sentence: string;
}

interface PreferenceLabels {
  preferencesTitle: string;
  preferencesSubtitle: string;
  preferencesNoData: string;
  lockButton: string;
  unlockButton: string;
  lockedBadge: string;
  resetButton: string;
  resetConfirm: string;
  resetDone: string;
  resetHint: string;
}

// Part 3's real review UI — the read-only "What's working" section
// above this one (creative-dna-insights.tsx) already showed real
// engagement performance; this shows the SEPARATE everyday-usage
// signal system (delete/publish/edit/regenerate/engagement-as-
// correction — aggregate.ts) in the same plain-language style, plus
// the lock/reset controls CLAUDE.md's Company Brain spec calls for
// (confirmed by audit: neither existed anywhere before this).
export function CreativeDnaPreferencesPanel({
  rows,
  lockedTopics,
  labels,
}: {
  rows: PreferenceRow[];
  lockedTopics: string[];
  labels: PreferenceLabels;
}) {
  const [pending, startTransition] = useTransition();
  const [locked, setLocked] = useState(new Set(lockedTopics));
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const dict = labels;

  function toggleLock(topic: string, isLocked: boolean) {
    setLocked((prev) => {
      const next = new Set(prev);
      if (isLocked) next.delete(topic);
      else next.add(topic);
      return next;
    });
    startTransition(async () => {
      if (isLocked) await unlockCreativeDnaTopic(topic);
      else await lockCreativeDnaTopic(topic);
    });
  }

  function handleReset() {
    if (!window.confirm(dict.resetConfirm)) return;
    startTransition(async () => {
      await resetCreativeDnaLearning();
      setResetMessage(dict.resetDone);
      setLocked(new Set());
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{dict.preferencesTitle}</h2>
      <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.preferencesSubtitle}</p>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.preferencesNoData}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((row) => {
            const isLocked = row.dimension === "topics" && locked.has(row.value);

            return (
              <li
                key={`${row.dimension}:${row.value}`}
                className="flex flex-col gap-1 rounded-md border border-paper-border dark:border-night-border p-2 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <p>{row.sentence}</p>
                  {row.dimension === "topics" && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => toggleLock(row.value, isLocked)}
                      className="shrink-0 text-xs font-medium text-ink-soft underline hover:text-ink disabled:opacity-60 dark:text-ink-soft-dark dark:hover:text-ink-dark"
                    >
                      {isLocked ? dict.unlockButton : dict.lockButton}
                    </button>
                  )}
                </div>
                {isLocked && <p className="text-xs text-amber-600 dark:text-amber-400">{dict.lockedBadge}</p>}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-2 flex flex-col items-start gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={handleReset}
          className="text-xs font-medium text-red-600 underline hover:text-red-700 disabled:opacity-60 dark:text-red-400 dark:hover:text-red-300"
        >
          {dict.resetButton}
        </button>
        <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.resetHint}</p>
        {resetMessage && <p className="text-xs text-green-700 dark:text-green-400">{resetMessage}</p>}
      </div>
    </div>
  );
}
