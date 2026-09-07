"use client";

import { useState } from "react";

import { SectionIcons } from "@/components/icons";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type MusicMood = "CALM" | "CONFIDENT" | "UPBEAT" | "WARM";

// Real proper nouns, the exact same 4 bundled tracks/titles already
// surfaced for CC BY 4.0 attribution in Settings' MusicCredits — never
// translated (same convention as that component's own titles), so a
// track picked by name here matches the name shown there.
const TRACKS: { mood: MusicMood; title: string }[] = [
  { mood: "CALM", title: "Wallpaper" },
  { mood: "CONFIDENT", title: "Deliberate Thought" },
  { mood: "UPBEAT", title: "Life of Riley" },
  { mood: "WARM", title: "Inspired" },
];

// Shared by the Video Studio creation form and the video editor's own
// script/scene save forms — one real "pick a track, set its volume"
// control, submitted as two plain form fields (musicTrack/musicVolume)
// so it works with each caller's existing useActionState submit, no
// separate save action needed. An empty musicTrack value means "Auto"
// (industry-based selection, this app's original default behavior).
export function MusicPicker({
  dict,
  defaultTrack,
  defaultVolume,
}: {
  dict: Dictionary["video"];
  defaultTrack?: MusicMood | null;
  defaultVolume?: number;
}) {
  const [volume, setVolume] = useState(defaultVolume ?? 100);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-paper-border p-3 dark:border-night-border">
      <h4 className="flex items-center gap-1.5 text-sm font-medium">
        <SectionIcons.music size={16} aria-hidden="true" />
        {dict.musicTitle}
      </h4>

      <div className="flex flex-col gap-1">
        <label htmlFor="musicTrack" className="text-xs font-medium text-ink-soft dark:text-ink-soft-dark">
          {dict.musicTrackLabel}
        </label>
        <select
          id="musicTrack"
          name="musicTrack"
          defaultValue={defaultTrack ?? ""}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        >
          <option value="">{dict.musicAuto}</option>
          {TRACKS.map((track) => (
            <option key={track.mood} value={track.mood}>
              {track.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label htmlFor="musicVolume" className="text-xs font-medium text-ink-soft dark:text-ink-soft-dark">
            {dict.musicVolumeLabel}
          </label>
          <span className="w-10 shrink-0 rounded-full bg-paper-card px-1.5 py-0.5 text-center text-[10px] font-medium tabular-nums text-ink-soft dark:bg-night-card dark:text-ink-soft-dark">
            {volume}%
          </span>
        </div>
        <input
          id="musicVolume"
          type="range"
          name="musicVolume"
          min={0}
          max={100}
          step={5}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label={dict.musicVolumeLabel}
          className="min-h-[36px] accent-current"
        />
      </div>
    </div>
  );
}
