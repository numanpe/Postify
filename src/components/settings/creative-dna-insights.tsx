import { TrendingUp } from "lucide-react";

import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { CreativeDnaConfidenceScores } from "@/lib/creative-dna/learning";

// Server component — pure display, no interactivity needed. Renders
// real, already-computed confidence scores (learning.ts) in plain
// language, per CLAUDE.md's "surface the confidence level, not just a
// binary learned/not-learned" and "avoid technical framing" rules — no
// raw numbers, no chart, just sentences a non-technical owner can read.
export async function CreativeDnaInsights({ confidenceScores }: { confidenceScores: unknown }) {
  const dict = getDictionary(await getLocale()).settings;
  const scores = confidenceScores as CreativeDnaConfidenceScores | null;
  const topics = scores?.topics ? Object.entries(scores.topics) : [];

  // Best-performing first — the plain-language summary leads with what's
  // actually worth acting on.
  const sorted = [...topics].sort((a, b) => b[1].relativeScore - a[1].relativeScore);
  const confidenceLabel: Record<"low" | "medium" | "high", string> = {
    low: dict.confidenceLow,
    medium: dict.confidenceMedium,
    high: dict.confidenceHigh,
  };

  return (
    <div className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <TrendingUp size={18} aria-hidden="true" />
        {dict.insightsTitle}
      </h2>
      {sorted.length === 0 ? (
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.insightsNoData}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {sorted.map(([topic, score]) => (
            <li
              key={topic}
              className="flex flex-col gap-0.5 rounded-md border border-paper-border dark:border-night-border p-2 text-sm"
            >
              <p>{dict.insightsSentence(topic, score.relativeScore)}</p>
              <p className="text-xs text-ink-soft dark:text-ink-soft-dark">
                {dict.insightsConfidence(confidenceLabel[score.confidenceTier], score.sampleSize)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
