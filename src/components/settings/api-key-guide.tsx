import type { Dictionary } from "@/lib/i18n/dictionaries";

// Static instructional content — plain <details>/<summary> accordions,
// no client JS needed. dict.settings.*GuideSteps are already ordered
// arrays, so the numbering itself carries real information (do these
// in this order), unlike a decorative 01/02/03 marker.
export function ApiKeyGuide({ dict }: { dict: Dictionary["settings"] }) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">{dict.apiKeyGuideTitle}</h2>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.apiKeyGuideSubtitle}</p>
      </div>

      <details className="group rounded-md border border-paper-border dark:border-night-border p-3">
        <summary className="cursor-pointer text-sm font-medium">{dict.openaiGuideTitle}</summary>
        <ol className="mt-3 flex flex-col gap-2 text-sm text-ink-soft dark:text-ink-soft-dark">
          {dict.openaiGuideSteps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-medium text-ink dark:text-ink-dark">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-medium text-primary hover:underline dark:text-primary-dark"
        >
          {dict.openaiGuideLinkLabel}
        </a>
      </details>

      <details className="group rounded-md border border-paper-border dark:border-night-border p-3">
        <summary className="cursor-pointer text-sm font-medium">{dict.elevenLabsGuideTitle}</summary>
        <ol className="mt-3 flex flex-col gap-2 text-sm text-ink-soft dark:text-ink-soft-dark">
          {dict.elevenLabsGuideSteps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-medium text-ink dark:text-ink-dark">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <a
          href="https://elevenlabs.io"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-medium text-primary hover:underline dark:text-primary-dark"
        >
          {dict.elevenLabsGuideLinkLabel}
        </a>
      </details>

      <details className="group rounded-md border border-paper-border dark:border-night-border p-3">
        <summary className="cursor-pointer text-sm font-medium">{dict.fishAudioGuideTitle}</summary>
        <ol className="mt-3 flex flex-col gap-2 text-sm text-ink-soft dark:text-ink-soft-dark">
          {dict.fishAudioGuideSteps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-medium text-ink dark:text-ink-dark">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-ink-soft dark:text-ink-soft-dark">{dict.fishAudioCostNote}</p>
        <a
          href="https://fish.audio"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-medium text-primary hover:underline dark:text-primary-dark"
        >
          {dict.fishAudioGuideLinkLabel}
        </a>
      </details>

      <details className="group rounded-md border border-paper-border dark:border-night-border p-3">
        <summary className="cursor-pointer text-sm font-medium">{dict.geminiGuideTitle}</summary>
        <ol className="mt-3 flex flex-col gap-2 text-sm text-ink-soft dark:text-ink-soft-dark">
          {dict.geminiGuideSteps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-medium text-ink dark:text-ink-dark">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-ink-soft dark:text-ink-soft-dark">{dict.geminiTextFreeNote}</p>
        <p className="mt-2 text-xs text-ink-soft dark:text-ink-soft-dark">{dict.geminiCostNote}</p>
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-medium text-primary hover:underline dark:text-primary-dark"
        >
          {dict.geminiGuideLinkLabel}
        </a>
      </details>
    </div>
  );
}
