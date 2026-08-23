import type { Dictionary } from "@/lib/i18n/dictionaries";

// Real product requirement, not decoration: the 4 bundled tracks
// (src/lib/video/music.ts, assets/music/README.md) are Creative
// Commons BY 4.0 — free for commercial use, but only with attribution
// given "in any reasonable manner based on the medium." A README in
// the repo doesn't satisfy that for a video a business owner actually
// publishes, so this surfaces the same attribution inside the product
// itself. Track titles/composer name are real proper nouns — never
// translated, same convention as PROVIDER_LABELS in settings/page.tsx.
const TRACKS = [
  { title: "Wallpaper", composer: "Kevin MacLeod" },
  { title: "Deliberate Thought", composer: "Kevin MacLeod" },
  { title: "Life of Riley", composer: "Kevin MacLeod" },
  { title: "Inspired", composer: "Kevin MacLeod" },
] as const;

export function MusicCredits({ dict }: { dict: Dictionary["settings"] }) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">{dict.musicCreditsTitle}</h2>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.musicCreditsSubtitle}</p>
      </div>

      <ul className="flex flex-col gap-1 text-sm">
        {TRACKS.map((track) => (
          <li key={track.title} className="flex items-center justify-between rounded-md border border-paper-border dark:border-night-border px-3 py-2">
            <span>&ldquo;{track.title}&rdquo;</span>
            <span className="text-ink-soft dark:text-ink-soft-dark">{track.composer}</span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.musicCreditsLicenseNote}</p>
      <a
        href="https://creativecommons.org/licenses/by/4.0/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-primary hover:underline dark:text-primary-dark"
      >
        {dict.musicCreditsLicenseLinkLabel}
      </a>
    </div>
  );
}
